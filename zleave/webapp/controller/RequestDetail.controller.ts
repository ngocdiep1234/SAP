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
import LeaveRequestService from "../service/LeaveRequestService";

interface LeaveTypeEntry {
    LeaveType: string;
    LeaveName: string;
    IsPaid: boolean;
    MaxDays: number;
}

export default class RequestDetail extends Controller {

    private _sUuid: string = "";
    private _bIsAdminMode: boolean = false;
    private _oLeaveRequestService: LeaveRequestService;

    private _getLeaveRequestService(): LeaveRequestService | null {
        if (!this._oLeaveRequestService) {
            const oRawModel = this.getView().getModel();
            if (!oRawModel) {
                return null;
            }
            this._oLeaveRequestService = new LeaveRequestService(
                oRawModel as InstanceType<typeof ODataModel>
            );
        }
        return this._oLeaveRequestService;
    }

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
        oRouter.getRoute("EmployeeLeaveRequestDetail").attachPatternMatched(this._onPatternMatched, this);
        oRouter.getRoute("AdminLeaveRequestDetail").attachPatternMatched(this._onPatternMatched, this);
    }

    private async _onPatternMatched(oEvent: any): Promise<void> {
        const sRouteName = oEvent.getParameter("name") as string;
        this._bIsAdminMode = sRouteName === "AdminLeaveRequestDetail";

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
                                    const sBackRoute = this._bIsAdminMode ? "AdminLeaveRequests" : "requests";
                                    oRouter.navTo(sBackRoute, {}, true);
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
                                    const sBackRoute = this._bIsAdminMode ? "AdminLeaveRequests" : "requests";
                                    oRouter.navTo(sBackRoute, {}, true);
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
        const oLeaveRequestService = this._getLeaveRequestService();
        if (!oLeaveRequestService) {
            return Promise.resolve();
        }
        return oLeaveRequestService.readLeaveTypes()
            .then((aTypes: LeaveTypeEntry[]): void => {
                if (aTypes.length === 0) {
                    MessageBox.warning("No leave types found on backend.");
                }
                this._getUiModel().setProperty("/leaveTypes", aTypes);
            })
            .catch((oErr: any): void => {
                console.error("[RequestDetail] Failed to load leave types:", oErr);
                MessageBox.error("Failed to load leave types from backend.");
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
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            this._getUiModel().setProperty("/editMode", true);
            return;
        }

        const oLeaveRequestService = this._getLeaveRequestService();
        const oUiModel = this._getUiModel();
        if (!oLeaveRequestService) {
            return;
        }
        oUiModel.setProperty("/busy", true);

        const sPath = oContext.getPath();
        oLeaveRequestService.readLeaveRequest(sPath)
            .then((oData: any): void => {
                oUiModel.setProperty("/busy", false);
                const sStatus = oData?.Status;
                if (sStatus === "SUBMITTED") {
                    oUiModel.setProperty("/editMode", true);
                } else {
                    MessageBox.error(`This request is now in "${sStatus}" status and can no longer be edited.`, {
                        onClose: () => {
                            void this._updateApproveRejectVisibility();
                        }
                    });
                }
            })
            .catch((oErr: any): void => {
                oUiModel.setProperty("/busy", false);
                MessageBox.error(typeof oErr === "string" ? oErr : "Failed to load the latest request details from backend.");
            });
    }

    public onCancelEdit(): void {
        const oUiModel = this._getUiModel();
        oUiModel.setProperty("/editMode", false);
        oUiModel.setProperty("/uploadStatusText", "");
        oUiModel.setProperty("/uploadButtonEnabled", false);

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        const oLeaveRequestService = this._getLeaveRequestService();
        if (oModel && oLeaveRequestService) {
            oModel.resetChanges();
            // Re-bind element to reload fresh data from backend
            const oContext = this.getView().getBindingContext();
            if (oContext) {
                const sPath = oContext.getPath();
                oLeaveRequestService.readLeaveRequest(sPath)
                    .then((): void => {
                        void this._updateApproveRejectVisibility();
                    })
                    .catch((oErr: any): void => {
                        console.error("[RequestDetail] Failed to refresh after cancel:", oErr);
                    });
            }
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

    /**
     * Normalize a local Date to midnight UTC so the correct calendar date
     * is sent to the backend regardless of the client's timezone offset.
     * Example: user picks 2026-07-17 in UTC+7 → local Date is 2026-07-17T00:00+07:00
     *          → serialized as 2026-07-16T17:00Z (wrong!) without this fix.
     */
    private _toUTCDate(d: Date): Date {
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    }

    public onUpdate(): void {
        const oContext = this.getView().getBindingContext();
        if (!oContext) {
            return;
        }

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        const oUiModel = this._getUiModel();

        // Read ALL editable field values directly from UI controls
        // to avoid OData two-way binding flush issues (same pattern as Reason/TextArea)
        const oCmbLeaveType = this.byId("cmbLeaveType") as any;
        const oDpStart = this.byId("dpStartDate") as any;
        const oDpEnd = this.byId("dpEndDate") as any;
        const oSelStart = this.byId("selStartSession") as any;
        const oSelEnd = this.byId("selEndSession") as any;
        const oTaReason = this.byId("taReason") as any;

        const sLeaveType = oCmbLeaveType ? (oCmbLeaveType.getSelectedKey() as string) : (oContext.getProperty("LeaveType") as string);
        const oStartDate = oDpStart ? (oDpStart.getDateValue() as Date | null) : (oContext.getProperty("StartDate") as Date | null);
        const oEndDate = oDpEnd ? (oDpEnd.getDateValue() as Date | null) : (oContext.getProperty("EndDate") as Date | null);
        const sStartSession = oSelStart ? (oSelStart.getSelectedKey() as string) : (oContext.getProperty("StartSession") as string || "");
        const sEndSession = oSelEnd ? (oSelEnd.getSelectedKey() as string) : (oContext.getProperty("EndSession") as string || "");
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

        const oLeaveRequestService = this._getLeaveRequestService();
        if (!oLeaveRequestService) {
            return;
        }
        oUiModel.setProperty("/busy", true);

        const sPath = oContext.getPath();
        const oPayload = {
            LeaveType: sLeaveType,
            StartDate: this._toUTCDate(oStartDate),
            EndDate: this._toUTCDate(oEndDate),
            StartSession: sStartSession,
            EndSession: sEndSession,
            TotalDays: String(nTotalDays),
            Reason: sReason,
            ApprovalComment: oContext.getProperty("ApprovalComment") || ""
        };

        oLeaveRequestService.updateLeaveRequest(sPath, oPayload)
            .then((): void => {
                oUiModel.setProperty("/editMode", false);
                MessageToast.show("Request updated successfully");

                // Clear any pending model changes to avoid stale state
                if (oModel) {
                    oModel.resetChanges();
                }

                // Use getElementBinding().refresh(true) — the correct SAPUI5 way to
                // force the view's binding context to re-fetch from backend and re-render
                const oElementBinding = this.getView().getElementBinding();
                if (oElementBinding) {
                    oElementBinding.refresh(true);
                }

                oUiModel.setProperty("/busy", false);
                void this._updateApproveRejectVisibility();
            })
            .catch((oErr: any): void => {
                oUiModel.setProperty("/busy", false);
                MessageBox.error(typeof oErr === "string" ? oErr : "Update failed.");
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

        const oLeaveRequestService = this._getLeaveRequestService();
        const oUiModel = this._getUiModel();
        if (!oLeaveRequestService) {
            return;
        }
        oUiModel.setProperty("/busy", true);

        const sPath = oContext.getPath();
        oLeaveRequestService.updateLeaveRequest(sPath, { Status: "Cancelled" })
            .then((): void => {
                MessageToast.show("Request cancelled successfully");
                const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
                if (oModel) {
                    oModel.refresh(true);
                }

                oLeaveRequestService.readLeaveRequest(sPath)
                    .then((): void => {
                        oUiModel.setProperty("/busy", false);
                        void this._updateApproveRejectVisibility();
                    })
                    .catch((oErr: any): void => {
                        oUiModel.setProperty("/busy", false);
                        console.error("Failed to refresh request details:", oErr);
                    });
            })
            .catch((oErr: any): void => {
                oUiModel.setProperty("/busy", false);
                MessageBox.error(typeof oErr === "string" ? oErr : "Cancellation failed.");
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

        const oLeaveRequestService = this._getLeaveRequestService();
        if (!oLeaveRequestService) {
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

            await oLeaveRequestService.updateLeaveRequest(sLeaveRequestPath, oPayload);

            // Call function import to finalize status change
            const oRes = await oLeaveRequestService.callAction(sActionName, sUuid);
            if (!oRes.success) {
                throw new Error(oRes.error || "Action failed.");
            }

            oUiModel.setProperty("/busy", true); // Ensure busy indicator is active during load
            const oResourceBundle = (this.getOwnerComponent().getModel("i18n") as any).getResourceBundle();
            const sSuccessMsg = sActionType === "approve"
                ? oResourceBundle.getText("successApproveSingle") || "Request approved successfully"
                : oResourceBundle.getText("successRejectSingle") || "Request rejected successfully";
            MessageToast.show(sSuccessMsg);

            const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
            if (oModel) {
                oModel.refresh(true);
            }

            const sPath = bIsHr
                ? `/LeaveRequestAdmin(guid'${sUuid}')`
                : `/LeaveRequest(guid'${sUuid}')`;

            oLeaveRequestService.readLeaveRequest(sPath)
                .then((): void => {
                    oUiModel.setProperty("/busy", false);
                    void this._updateApproveRejectVisibility();
                })
                .catch((oErr: any): void => {
                    oUiModel.setProperty("/busy", false);
                    console.error("Failed to refresh request details:", oErr);
                });
        } catch (oErr: any) {
            oUiModel.setProperty("/busy", false);
            let sMsg = sActionType === "approve" ? "Approval failed." : "Rejection failed.";
            if (typeof oErr === "string") {
                sMsg = oErr;
            } else if (oErr && oErr.message) {
                sMsg = oErr.message;
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
            const sBackRoute = this._bIsAdminMode ? "AdminLeaveRequests" : "requests";
            oRouter.navTo(sBackRoute, {}, true);
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

        const oLeaveRequestService = this._getLeaveRequestService();
        if (!oLeaveRequestService) {
            return;
        }

        const oUiModel = this._getUiModel();
        oUiModel.setProperty("/uploading", true);
        oUiModel.setProperty("/uploadProgress", 50);
        oUiModel.setProperty("/uploadStatusText", "Uploading...");

        const sUuid = oContext.getProperty("UUID") as string;
        oLeaveRequestService.uploadAttachment(sUuid, oFile)
            .then((): Promise<any> => {
                oUiModel.setProperty("/uploadProgress", 100);
                oUiModel.setProperty("/uploadStatusText", "File uploaded successfully.");
                MessageToast.show("File uploaded successfully");
                
                const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
                if (oModel) {
                    oModel.refresh(true);
                }

                return oLeaveRequestService.readLeaveRequest(oContext.getPath());
            })
            .then((): void => {
                oUiModel.setProperty("/uploading", false);
                oUiModel.setProperty("/uploadButtonEnabled", false);
                void this._updateApproveRejectVisibility();
            })
            .catch((oErr: any): void => {
                oUiModel.setProperty("/uploading", false);
                MessageBox.error(typeof oErr === "string" ? oErr : "Upload failed.");
            });
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
