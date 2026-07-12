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
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import TextArea from "sap/m/TextArea";
import Label from "sap/m/Label";

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
            uploadButtonEnabled: false,
            canApprove: false,
            canReject: false
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
        oUiModel.setProperty("/canApprove", false);
        oUiModel.setProperty("/canReject", false);
        // NOTE: Do NOT set busy=true here. Let dataRequested/dataReceived control it.

        try {
            const oCurrentUser = await this._getCurrentUser();
            const bIsHrAdmin = oCurrentUser.is_admin === "X" || oCurrentUser.is_hr === "X";
            oUiModel.setProperty("/isHrAdmin", bIsHrAdmin);

            const sEntitySet = bIsHrAdmin ? "/LeaveRequestAdmin" : "/LeaveRequest";
            const sPath = `${sEntitySet}(guid'${sUuid}')`;

            this.getView().bindElement({
                path: sPath,
                events: {
                    dataRequested: (): void => {
                        oUiModel.setProperty("/busy", true);
                    },
                    dataReceived: (oEvent: any): void => {
                        oUiModel.setProperty("/busy", false);
                        const oData = oEvent.getParameter("data");
                        if (!oData) {
                            MessageBox.error("Request details not found or could not be loaded.", {
                                onClose: () => {
                                    const oRouter = (this.getOwnerComponent() as any).getRouter();
                                    oRouter.navTo("requests", {}, true);
                                }
                            });
                        }
                        void this._updateApproveRejectVisibility();
                    },
                    change: (): void => {
                        const oContext = this.getView().getBindingContext();
                        if (!oContext && !oUiModel.getProperty("/busy")) {
                            MessageBox.error("Request details not found.", {
                                onClose: () => {
                                    const oRouter = (this.getOwnerComponent() as any).getRouter();
                                    oRouter.navTo("requests", {}, true);
                                }
                            });
                        }
                        void this._updateApproveRejectVisibility();
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
                    if (aTypes.length === 0) {
                        MessageBox.warning("No leave types found on backend.");
                    }
                    this._getUiModel().setProperty("/leaveTypes", aTypes);
                    resolve();
                },
                error: (oErr: any): void => {
                    console.error("[RequestDetail] Failed to load leave types:", oErr);
                    MessageBox.error("Failed to load leave types from backend.");
                    resolve();
                }
            });
        });
    }

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string }> {
        const oComponent = (this as any).getOwnerComponent() as any;
        return oComponent.getCurrentUser();
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

    public onApprove(): void {
        void this._showCommentDialog("approve");
    }

    public onReject(): void {
        void this._showCommentDialog("reject");
    }

    private async _showCommentDialog(sActionType: "approve" | "reject"): Promise<void> {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const oResourceBundle = (this.getOwnerComponent().getModel("i18n") as any).getResourceBundle();
        const oCurrentUser = await this._getCurrentUser();
        const vIsHr = oCurrentUser.is_hr;
        const bIsHr = vIsHr === "X" || vIsHr === "true" || vIsHr === "1";

        const sCommentLabel = bIsHr 
            ? "Enter HR comment (optional):"
            : "Enter Manager comment (optional):";

        const sTitle = sActionType === "approve"
            ? (oResourceBundle.getText("confirmApproveTitle") || "Confirm Approve")
            : (oResourceBundle.getText("confirmRejectTitle") || "Confirm Reject");

        const oTextArea = new TextArea({
            width: "100%",
            rows: 3,
            placeholder: "Type your comment here...",
            growing: true
        });

        const oDlg = new Dialog({
            title: sTitle,
            type: "Message",
            content: [
                new Label({ text: sCommentLabel, labelFor: oTextArea }),
                oTextArea
            ],
            beginButton: new Button({
                text: oResourceBundle.getText("yes") || "Yes",
                press: () => {
                    const sComment = oTextArea.getValue().trim();
                    oDlg.close();
                    void this._executeAction(sActionType, sComment);
                }
            }),
            endButton: new Button({
                text: oResourceBundle.getText("no") || "No",
                press: () => {
                    oDlg.close();
                }
            }),
            afterClose: () => {
                oDlg.destroy();
            }
        });

        oDlg.open();
    }

    private async _executeAction(sActionType: "approve" | "reject", sComment: string): Promise<void> {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        if (!oModel) {
            return;
        }
        const oUiModel = this._getUiModel();
        oUiModel.setProperty("/busy", true);

        const oCurrentUser = await this._getCurrentUser();
        const vIsHr = oCurrentUser.is_hr;
        const bIsHr = vIsHr === "X" || vIsHr === "true" || vIsHr === "1";

        const sActionName = this._getActionName(sActionType, bIsHr);
        const sUuid = oContext.getProperty("UUID") as string;
        const sLeaveRequestPath = `/LeaveRequest(guid'${sUuid}')`;

        try {
            // Save comment to the backend first
            const oPayload: Record<string, string> = {};
            if (bIsHr) {
                oPayload.HrComment = sComment;
            } else {
                oPayload.ApprovalComment = sComment;
            }

            await new Promise<void>((resolve, reject) => {
                oModel.update(sLeaveRequestPath, oPayload, {
                    success: () => resolve(),
                    error: (oErr: any) => reject(oErr)
                });
            });

            // Call function import to finalize status change
            await this._callAction(sActionName, sUuid);
            oUiModel.setProperty("/busy", false);
            const oResourceBundle = (this.getOwnerComponent().getModel("i18n") as any).getResourceBundle();
            const sSuccessMsg = sActionType === "approve"
                ? oResourceBundle.getText("successApproveSingle") || "Request approved successfully"
                : oResourceBundle.getText("successRejectSingle") || "Request rejected successfully";
            MessageToast.show(sSuccessMsg);
            oModel.refresh(true);
        } catch (oErr: any) {
            oUiModel.setProperty("/busy", false);
            let sMsg = sActionType === "approve" ? "Approval failed." : "Rejection failed.";
            try {
                const oErrorData = oErr.error || oErr;
                if (oErrorData && oErrorData.responseText) {
                    const oParsed = JSON.parse(oErrorData.responseText);
                    sMsg = oParsed.error?.message?.value || sMsg;
                } else if (oErrorData && oErrorData.message) {
                    sMsg = oErrorData.message;
                }
            } catch {
                // ignore
            }
            MessageBox.error(sMsg);
        }
    }

    private _getActionName(sActionType: "approve" | "reject", bIsHr: boolean): string {
        const oModel: any = this.getView().getModel();
        if (oModel && typeof oModel.getServiceMetadata === "function") {
            const oMetadata = oModel.getServiceMetadata();
            if (oMetadata && oMetadata.dataServices && oMetadata.dataServices.schema) {
                const aSchemas = oMetadata.dataServices.schema;
                for (const oSchema of aSchemas) {
                    if (oSchema.entityContainer) {
                        const aContainers = Array.isArray(oSchema.entityContainer) ? oSchema.entityContainer : [oSchema.entityContainer];
                        for (const oContainer of aContainers) {
                            if (oContainer.functionImport) {
                                const aFuncs = Array.isArray(oContainer.functionImport) ? oContainer.functionImport : [oContainer.functionImport];
                                const sTargetName = bIsHr
                                    ? (sActionType === "approve" ? "hrApproveResult" : "hrRejectResult")
                                    : (sActionType === "approve" ? "approveResult" : "rejectResult");
                                const sAltName = bIsHr
                                    ? (sActionType === "approve" ? "hrApproveLeave" : "hrRejectLeave")
                                    : (sActionType === "approve" ? "approveLeave" : "rejectLeave");
                                if (aFuncs.some((f: any) => f.name === sTargetName)) {
                                    return sTargetName;
                                }
                                if (aFuncs.some((f: any) => f.name === sAltName)) {
                                    return sAltName;
                                }
                            }
                        }
                    }
                }
            }
        }
        return bIsHr
            ? (sActionType === "approve" ? "hrApproveResult" : "hrRejectResult")
            : (sActionType === "approve" ? "approveLeave" : "rejectLeave");
    }

    private _callAction(sActionName: string, sUuid: string): Promise<{ success: boolean; uuid: string; error?: string }> {
        const oModel: any = this.getView().getModel();
        return new Promise((resolve, reject) => {
            if (!oModel) {
                reject(new Error("OData Model is not available"));
                return;
            }
            oModel.callFunction("/" + sActionName, {
                method: "POST",
                urlParameters: {
                    UUID: sUuid
                },
                success: () => {
                    resolve({ success: true, uuid: sUuid });
                },
                error: (oError: any) => {
                    let sMsg = "Unknown error";
                    try {
                        if (oError && oError.responseText) {
                            const oParsed = JSON.parse(oError.responseText);
                            sMsg = (oParsed.error && oParsed.error.message && oParsed.error.message.value) || sMsg;
                        } else if (oError && oError.message) {
                            sMsg = oError.message;
                        }
                    } catch {
                        sMsg = (oError && oError.message) || sMsg;
                    }
                    const oErr = new Error(sMsg);
                    if (oError && oError.responseText) {
                        (oErr as any).responseText = oError.responseText;
                    }
                    reject(oErr);
                }
            });
        });
    }

    private async _updateApproveRejectVisibility(): Promise<void> {
        const oContext = this.getView().getBindingContext();
        const oUiModel = this._getUiModel();
        if (!oContext) {
            oUiModel.setProperty("/canApprove", false);
            oUiModel.setProperty("/canReject", false);
            return;
        }

        try {
            const oCurrentUser = await this._getCurrentUser();
            const sCurrentEmployeeId = String(parseInt(oCurrentUser.employeeId, 10));
            const sReqEmployeeId = String(parseInt(oContext.getProperty("EmployeeId") as string || "", 10));

            // User cannot approve/reject their own request
            if (sCurrentEmployeeId === sReqEmployeeId) {
                oUiModel.setProperty("/canApprove", false);
                oUiModel.setProperty("/canReject", false);
                return;
            }

            const vIsHr = oCurrentUser.is_hr;
            const bIsHr = vIsHr === "X" || vIsHr === "true" || vIsHr === "1";
            const vIsManager = oCurrentUser.is_manager;
            const bIsManager = vIsManager === "X" || vIsManager === "true" || vIsManager === "1";

            if (!bIsHr && !bIsManager) {
                oUiModel.setProperty("/canApprove", false);
                oUiModel.setProperty("/canReject", false);
                return;
            }

            const bApproveAc = bIsHr
                ? (oContext.getProperty("hrApproveResult_ac") ?? oContext.getProperty("hrApproveLeave_ac"))
                : (oContext.getProperty("approveLeave_ac") ?? oContext.getProperty("approveResult_ac"));
            const bRejectAc = bIsHr
                ? (oContext.getProperty("hrRejectResult_ac") ?? oContext.getProperty("hrRejectLeave_ac"))
                : (oContext.getProperty("rejectLeave_ac") ?? oContext.getProperty("rejectResult_ac"));

            const sStatus = String(oContext.getProperty("Status") || "").toUpperCase();
            const sPendingStatus = bIsHr ? "MGR_APPROVED" : "SUBMITTED";
            const bStatusEligible = sStatus === sPendingStatus
                || sStatus === "SUBMITTED"
                || sStatus === "PENDING"
                || sStatus === "MGR_APPROVED";

            const bCanApprove = bApproveAc !== undefined ? bApproveAc === true : bStatusEligible;
            const bCanReject = bRejectAc !== undefined ? bRejectAc === true : bStatusEligible;

            oUiModel.setProperty("/canApprove", bCanApprove);
            oUiModel.setProperty("/canReject", bCanReject);
        } catch {
            // Failed to update visibility
            oUiModel.setProperty("/canApprove", false);
            oUiModel.setProperty("/canReject", false);
        }
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
