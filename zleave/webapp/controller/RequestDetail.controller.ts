import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import Router from "sap/ui/core/routing/Router";
import History from "sap/ui/core/routing/History";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Event from "sap/ui/base/Event";

interface LeaveTypeEntry {
    LeaveType: string;
    LeaveName: string;
    IsPaid: boolean;
    MaxDays: number;
}

export default class RequestDetail extends Controller {

    private _sUuid: string = "";

    public onInit(): void {
        const oUiModel = new JSONModel({
            editMode: false,
            isHrAdmin: false,
            busy: false,
            leaveTypes: [],
            uploadProgress: 0,
            uploading: false,
            uploadStatusText: "",
            uploadButtonEnabled: false
        });
        this.getView().setModel(oUiModel, "detailUi");

        const oRouter = (this.getOwnerComponent() as { getRouter(): InstanceType<typeof Router> }).getRouter();
        oRouter.getRoute("requestDetail").attachPatternMatched(this._onPatternMatched, this);
    }

    private async _onPatternMatched(oEvent: any): Promise<void> {
        const oArgs = oEvent.getParameter("arguments") as { uuid: string };
        const sUuid = oArgs.uuid;
        this._sUuid = sUuid;

        const oUiModel = this._getUiModel();
        oUiModel.setProperty("/editMode", false);
        oUiModel.setProperty("/uploadProgress", 0);
        oUiModel.setProperty("/uploading", false);
        oUiModel.setProperty("/uploadStatusText", "");
        oUiModel.setProperty("/uploadButtonEnabled", false);
        // NOTE: Do NOT set busy=true here. Let dataRequested/dataReceived control it.

        try {
            const oCurrentUser = await this._getCurrentUser();
            const bIsHrAdmin = oCurrentUser.is_admin === "X";
            oUiModel.setProperty("/isHrAdmin", bIsHrAdmin);

            const sEntitySet = bIsHrAdmin ? "/LeaveRequestAdmin" : "/LeaveRequest";
            const sPath = `${sEntitySet}(guid'${sUuid}')`;

            this.getView().bindElement({
                path: sPath,
                events: {
                    dataRequested: (): void => {
                        oUiModel.setProperty("/busy", true);
                    },
                    dataReceived: (): void => {
                        oUiModel.setProperty("/busy", false);
                    }
                }
            });

            await this._loadLeaveTypes();

        } catch (oErr) {
            console.error("[RequestDetail] Error in pattern matched:", oErr);
            oUiModel.setProperty("/busy", false);
            MessageBox.error("Failed to load request details.");
        }
    }

    private _getUiModel(): InstanceType<typeof JSONModel> {
        return this.getView().getModel("detailUi") as InstanceType<typeof JSONModel>;
    }

    private _loadLeaveTypes(): Promise<void> {
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        if (!oModel) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            oModel.read("/LeaveType", {
                success: (oData: any): void => {
                    const aTypes = (oData.results || []) as LeaveTypeEntry[];
                    this._getUiModel().setProperty("/leaveTypes", aTypes);
                    resolve();
                },
                error: (oErr: any): void => {
                    console.error("[RequestDetail] Failed to load leave types:", oErr);
                    resolve();
                }
            });
        });
    }

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string }> {
        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (!oUiModel) {
            return { registered: true, employeeId: "1001", employeeName: "Nguyen Van A", role: "Employee", is_manager: "", is_hr: "", is_admin: "" };
        }

        const oCachedUser = oUiModel.getProperty("/currentUser") as any;
        if (oCachedUser && oCachedUser.employeeId && oCachedUser.role) {
            return oCachedUser as { registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string };
        }

        let sSapUser = oCachedUser?.id as string | undefined;

        if (!sSapUser) {
            try {
                const oResponse = await fetch("/sap/bc/ui2/start_up", {
                    credentials: "same-origin"
                });
                if (oResponse.ok) {
                    const oData = await oResponse.json() as Record<string, unknown>;
                    sSapUser = (oData["id"] as string) ??
                        (oData["userId"] as string) ??
                        (oData["name"] as string) ??
                        "";
                }
            } catch (oErr) {
                console.error("[RequestDetail] fetch /sap/bc/ui2/start_up failed:", oErr);
            }
        }

        if (sSapUser) {
            const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
            if (oModel) {
                try {
                    const oResult = await new Promise<any>((resolve, reject) => {
                        oModel.read("/Employee", {
                            filters: [
                                new Filter("SapUserName", FilterOperator.EQ, sSapUser)
                            ],
                            success: (oDataSuccess: any) => resolve(oDataSuccess),
                            error: (oError: any) => reject(oError)
                        });
                    });
                    if (oResult && oResult.results && oResult.results.length > 0) {
                        const oEmp = oResult.results[0];
                        const oUserObj = {
                            registered: true,
                            employeeId: String(oEmp["EmployeeId"] ?? ""),
                            employeeName: String(oEmp["FullName"] ?? oEmp["SapUserName"] ?? ""),
                            id: sSapUser,
                            displayName: String(oEmp["FullName"] ?? oEmp["SapUserName"] ?? ""),
                            role: String(oEmp["PositionTitle"] ?? "Employee"),
                            is_manager: String(oEmp["IsManager"] ?? ""),
                            is_hr: String(oEmp["IsHR"] ?? ""),
                            is_admin: String(oEmp["IsAdmin"] ?? "")
                        };
                        oUiModel.setProperty("/currentUser", oUserObj);
                        console.log("[DEBUG] [RequestDetail] Current user loaded:", oUserObj);
                        return oUserObj;
                    }
                } catch (oErr) {
                    console.error("[RequestDetail] Querying Employee by SapUserName failed:", oErr);
                }
            }
        }

        const oMockUser = {
            registered: true,
            employeeId: "1001",
            employeeName: "Nguyen Van A",
            role: "Employee",
            is_manager: "",
            is_hr: "",
            is_admin: ""
        };
        oUiModel.setProperty("/currentUser", oMockUser);
        return oMockUser;
    }

    public formatSession(sSession: string): string {
        if (sSession === "M") {
            return "Morning";
        }
        if (sSession === "A") {
            return "Afternoon";
        }
        return "Full Day";
    }

    public formatFileName(sUrl: string): string {
        if (!sUrl) {
            return "";
        }
        return sUrl.split("/").pop() || sUrl;
    }

    public onEdit(): void {
        this._getUiModel().setProperty("/editMode", true);
    }

    public onCancelEdit(): void {
        this._getUiModel().setProperty("/editMode", false);
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        if (oModel) {
            oModel.resetChanges();
        }
    }

    public onLeaveTypeChange(): void {
        this.onDatesChange();
    }

    public onDatesChange(): void {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const oDpStart = this.byId("dpStartDate") as any;
        const oDpEnd = this.byId("dpEndDate") as any;
        const oSelStart = this.byId("selStartSession") as any;
        const oSelEnd = this.byId("selEndSession") as any;

        const dStart = oDpStart ? oDpStart.getDateValue() as Date | null : null;
        const dEnd = oDpEnd ? oDpEnd.getDateValue() as Date | null : null;
        const sStartSession = oSelStart ? oSelStart.getSelectedKey() as string : "";
        const sEndSession = oSelEnd ? oSelEnd.getSelectedKey() as string : "";

        if (!dStart || !dEnd) {
            return;
        }

        if (dEnd < dStart) {
            const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
            oModel.setProperty(oContext.getPath() + "/TotalDays", 0);
            return;
        }

        const dStartZero = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate());
        const dEndZero = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate());
        const nDiffTime = dEndZero.getTime() - dStartZero.getTime();
        let nDays = Math.ceil(nDiffTime / (1000 * 60 * 60 * 24)) + 1;

        if (nDays === 1) {
            if (sStartSession === "M" && sEndSession === "M") {
                nDays = 0.5;
            } else if (sStartSession === "A" && sEndSession === "A") {
                nDays = 0.5;
            }
        } else if (nDays > 1) {
            if (sStartSession === "A") {
                nDays -= 0.5;
            }
            if (sEndSession === "M") {
                nDays -= 0.5;
            }
        }

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        oModel.setProperty(oContext.getPath() + "/TotalDays", nDays);
    }

    public onUpdate(): void {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        const oUiModel = this._getUiModel();

        const sLeaveType = oContext.getProperty("LeaveType") as string;
        const oStartDate = oContext.getProperty("StartDate") as Date | null;
        const oEndDate = oContext.getProperty("EndDate") as Date | null;
        // Read Reason directly from the TextArea control to avoid OData two-way binding flush issue
        const oTaReason = this.byId("taReason") as any;
        const sReason = (oTaReason ? oTaReason.getValue() as string : (oContext.getProperty("Reason") as string || "")).trim();
        const nTotalDays = Number(oContext.getProperty("TotalDays") ?? 0);

        if (!sLeaveType) {
            MessageBox.error("Please select a Leave Type.");
            return;
        }

        if (!oStartDate) {
            MessageBox.error("Please select a Start Date.");
            return;
        }

        if (!oEndDate) {
            MessageBox.error("Please select an End Date.");
            return;
        }

        if (oEndDate < oStartDate) {
            MessageBox.error("End date cannot be earlier than start date.");
            return;
        }

        if (nTotalDays <= 0) {
            MessageBox.error("Total days must be greater than 0.");
            return;
        }

        if (sReason.length < 5) {
            MessageBox.error("Reason must be at least 5 characters.");
            return;
        }

        oUiModel.setProperty("/busy", true);

        const sPath = oContext.getPath();
        const oPayload = {
            LeaveType: sLeaveType,
            StartDate: oStartDate,
            EndDate: oEndDate,
            StartSession: oContext.getProperty("StartSession") || "",
            EndSession: oContext.getProperty("EndSession") || "",
            TotalDays: String(nTotalDays),
            Reason: sReason,
            ApprovalComment: oContext.getProperty("ApprovalComment") || ""
        };

        oModel.update(sPath, oPayload, {
            success: (): void => {
                oUiModel.setProperty("/busy", false);
                oUiModel.setProperty("/editMode", false);
                MessageToast.show("Request updated successfully");
                oModel.refresh(true);
            },
            error: (oErr: any): void => {
                oUiModel.setProperty("/busy", false);
                let sMsg = "Update failed.";
                try {
                    if (oErr && oErr.responseText) {
                        const oParsed = JSON.parse(oErr.responseText);
                        sMsg = oParsed.error?.message?.value || sMsg;
                    }
                } catch (e) {
                    // ignore
                }
                MessageBox.error(sMsg);
            }
        });
    }

    public onCancelRequest(): void {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        MessageBox.confirm("Are you sure you want to cancel this leave request?", {
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            onClose: (sAction?: string): void => {
                if (sAction === MessageBox.Action.YES) {
                    this._executeCancelRequest();
                }
            }
        });
    }

    private _executeCancelRequest(): void {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        const oUiModel = this._getUiModel();
        oUiModel.setProperty("/busy", true);

        const sPath = oContext.getPath();
        oModel.update(sPath, { Status: "Cancelled" }, {
            success: (): void => {
                oUiModel.setProperty("/busy", false);
                MessageToast.show("Request cancelled successfully");
                oModel.refresh(true);
            },
            error: (oErr: any): void => {
                oUiModel.setProperty("/busy", false);
                let sMsg = "Cancellation failed.";
                try {
                    if (oErr && oErr.responseText) {
                        const oParsed = JSON.parse(oErr.responseText);
                        sMsg = oParsed.error?.message?.value || sMsg;
                    }
                } catch (e) {
                    // ignore
                }
                MessageBox.error(sMsg);
            }
        });
    }

    public onNavBack(): void {
        const oHistory = History.getInstance();
        const sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
            window.history.go(-1);
        } else {
            const oRouter = (this.getOwnerComponent() as { getRouter(): InstanceType<typeof Router> }).getRouter();
            oRouter.navTo("requests", {}, true);
        }
    }

    // -----------------------------------------------------------------------
    // Attachments logic (Simulated upload/download/open)
    // -----------------------------------------------------------------------

    public onFileChange(oEvent: any): void {
        const aFiles = oEvent.getParameter("files") as File[] || [];
        const oUiModel = this._getUiModel();

        if (aFiles.length === 0) {
            oUiModel.setProperty("/uploadButtonEnabled", false);
            return;
        }

        const oFile = aFiles[0];
        const nSizeMb = oFile.size / (1024 * 1024);

        if (nSizeMb > 10) {
            MessageBox.error("File size exceeds 10 MB limit.");
            oUiModel.setProperty("/uploadButtonEnabled", false);
            const oFileUploader = this.byId("fileUploader") as any;
            if (oFileUploader) {
                oFileUploader.clear();
            }
            return;
        }

        oUiModel.setProperty("/uploadButtonEnabled", true);
        oUiModel.setProperty("/uploadStatusText", "");
    }

    public onFileSizeExceeds(): void {
        MessageBox.error("File size must not exceed 10 MB.");
        this._getUiModel().setProperty("/uploadButtonEnabled", false);
    }

    public onTypeMismatch(): void {
        MessageBox.error("Only PDF, JPG, JPEG, and PNG files are allowed.");
        this._getUiModel().setProperty("/uploadButtonEnabled", false);
    }

    public onUploadAttachment(): void {
        const oFileUploader = this.byId("fileUploader") as any;
        if (!oFileUploader) {
            return;
        }

        const aFiles = oFileUploader.oFileUpload.files as FileList | undefined;
        if (!aFiles || aFiles.length === 0) {
            MessageBox.error("Please choose a file to upload first.");
            return;
        }

        const oFile = aFiles[0];
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        const oUiModel = this._getUiModel();

        oUiModel.setProperty("/uploading", true);
        oUiModel.setProperty("/uploadProgress", 50);
        oUiModel.setProperty("/uploadStatusText", "Uploading...");

        const sUuid = oContext.getProperty("UUID") as string;
        let sServiceUrl = oModel.sServiceUrl;
        if (sServiceUrl.endsWith("/")) {
            sServiceUrl = sServiceUrl.slice(0, -1);
        }
        const sUrl = `${sServiceUrl}/LeaveRequest(guid'${sUuid}')/$value`;
        const sToken = oModel.getSecurityToken() || "";

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", sUrl, true);
        xhr.setRequestHeader("x-csrf-token", sToken);
        xhr.setRequestHeader("Slug", oFile.name);
        if (oFile.type) {
            xhr.setRequestHeader("Content-Type", oFile.type);
        }

        xhr.onload = (): void => {
            if (xhr.status >= 200 && xhr.status < 300) {
                oModel.setProperty(oContext.getPath() + "/FileName", oFile.name);
                oModel.setProperty(oContext.getPath() + "/MimeType", oFile.type);
                
                oModel.submitChanges({
                    success: (): void => {
                        oUiModel.setProperty("/uploadProgress", 100);
                        oUiModel.setProperty("/uploading", false);
                        oUiModel.setProperty("/uploadButtonEnabled", false);
                        oUiModel.setProperty("/uploadStatusText", "File uploaded successfully.");
                        MessageToast.show("File uploaded successfully");
                        oModel.refresh(true);
                    },
                    error: (oErr: any): void => {
                        oUiModel.setProperty("/uploading", false);
                        MessageBox.error("Upload succeeded but failed to save metadata.");
                    }
                });
            } else {
                oUiModel.setProperty("/uploading", false);
                MessageBox.error(`Upload failed with status: ${xhr.status} ${xhr.statusText}`);
            }
        };

        xhr.onerror = (): void => {
            oUiModel.setProperty("/uploading", false);
            MessageBox.error("Upload failed due to a network error.");
        };

        xhr.send(oFile);
    }

    public onDownloadAttachment(): void {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const sFileName = oContext.getProperty("FileName") as string;
        const sUuid = oContext.getProperty("UUID") as string;
        if (sFileName && sUuid) {
            const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
            let sServiceUrl = oModel.sServiceUrl;
            if (sServiceUrl.endsWith("/")) {
                sServiceUrl = sServiceUrl.slice(0, -1);
            }
            const sUrl = `${sServiceUrl}/LeaveRequest(guid'${sUuid}')/$value`;

            const link = document.createElement("a");
            link.href = sUrl;
            link.download = sFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    public onOpenAttachment(): void {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const sFileName = oContext.getProperty("FileName") as string;
        const sUuid = oContext.getProperty("UUID") as string;
        if (sFileName && sUuid) {
            const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
            let sServiceUrl = oModel.sServiceUrl;
            if (sServiceUrl.endsWith("/")) {
                sServiceUrl = sServiceUrl.slice(0, -1);
            }
            const sUrl = `${sServiceUrl}/LeaveRequest(guid'${sUuid}')/$value`;
            window.open(sUrl, "_blank");
        }
    }
}
