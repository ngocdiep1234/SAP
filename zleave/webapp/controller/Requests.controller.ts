
import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Label from "sap/m/Label";
import Input from "sap/m/Input";
import DatePicker from "sap/m/DatePicker";
import TextArea from "sap/m/TextArea";
import VBox from "sap/m/VBox";
import MessageBox from "sap/m/MessageBox";
import Select from "sap/m/Select";
import Table from "sap/m/Table";
import ListItemBase from "sap/m/ListItemBase";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Event from "sap/ui/base/Event";
import JSONModel from "sap/ui/model/json/JSONModel";

export default class Requests extends Controller {

    public onInit(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("requests").attachPatternMatched(this._onPatternMatched, this);
    }

    private _onPatternMatched(): void {
        const oUiModel = this.getView().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "requests");
        }

        const oSelect = this.getView().byId("filterStatus") as InstanceType<typeof Select> | undefined;
        if (oSelect) {
            oSelect.setSelectedKey("SUBMITTED");
        }
        this.applyStatusFilter("SUBMITTED");
        this.updateToolbarVisibility("SUBMITTED");
        this._loadEmployees();
    }

    public onSelectionChange(): void {
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (!oTable) { return; }
        const aSelectedItems = oTable.getSelectedItems() || [];
        const oBtnApprove = this.getView().byId("btnApproveSelected") as InstanceType<typeof Button> | undefined;
        const oBtnReject = this.getView().byId("btnRejectSelected") as InstanceType<typeof Button> | undefined;
        const oBtnDelete = this.getView().byId("btnDeleteSelected") as InstanceType<typeof Button> | undefined;

        const bEnabled = aSelectedItems.length > 0 && aSelectedItems.some((oItem: InstanceType<typeof ListItemBase>) => {
            const oContext = oItem.getBindingContext();
            if (!oContext) { return false; }
            const sStatus = String(oContext.getProperty("Status") || "").toUpperCase();
            return sStatus === "SUBMITTED" || sStatus === "PENDING";
        });

        if (oBtnApprove) { oBtnApprove.setEnabled(bEnabled); }
        if (oBtnReject) { oBtnReject.setEnabled(bEnabled); }
        if (oBtnDelete) {
            oBtnDelete.setEnabled(aSelectedItems.length > 0);
        }
    }

    private _loadEmployees(): void {
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (!oModel || !oUiModel) {
            return;
        }

        oModel.read("/Employee", {
            success: (oData: any): void => {
                const aEmployees = oData.results || [];
                const oMap: Record<string, string> = {};
                aEmployees.forEach((emp: any) => {
                    oMap[emp.EmployeeId] = emp.FullName || emp.SapUserName;
                });
                oUiModel.setProperty("/employeesMap", oMap);
            },
            error: (): void => {
                // Ignore or log
            }
        });
    }

    public formatEmployeeName(
        sEmployeeId: string,
        oMap: Record<string, string>
    ): string {

        if (!sEmployeeId || !oMap) {
            return "";
        }

        const sNormalizedId = sEmployeeId.padStart(8, "0");

        return oMap[sNormalizedId] || sEmployeeId;
    }

    public onItemPress(oEvent: InstanceType<typeof Event>): void {
        const oItem = oEvent.getSource() as InstanceType<typeof ListItemBase>;
        const oContext = oItem.getBindingContext();
        if (!oContext) {
            return;
        }

        const sRequestId = String(oContext.getProperty("RequestId") || "Unknown");
        const sEmployeeId = String(oContext.getProperty("EmployeeId") || "");

        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        const oMap = oUiModel?.getProperty("/employeesMap") as Record<string, string> | undefined;
        const sEmployeeName = oMap && sEmployeeId && oMap[sEmployeeId] ? oMap[sEmployeeId] : sEmployeeId || "Unknown";

        const sLeaveType = String(oContext.getProperty("LeaveType") || "");
        const oStartDate = oContext.getProperty("StartDate");
        const oEndDate = oContext.getProperty("EndDate");
        const sStartDate = oStartDate instanceof Date ? oStartDate.toLocaleDateString() : String(oStartDate || "");
        const sEndDate = oEndDate instanceof Date ? oEndDate.toLocaleDateString() : String(oEndDate || "");
        const sTotalDays = String(oContext.getProperty("TotalDays") || "0");
        const sStatus = String(oContext.getProperty("Status") || "");
        const sReason = String(oContext.getProperty("Reason") || "No reason provided");

        MessageBox.information(
            `Request ID: ${sRequestId}\n` +
            `Employee ID: ${sEmployeeId}\n` +
            `Type: ${sLeaveType}\n` +
            `Start Date: ${sStartDate}\n` +
            `End Date: ${sEndDate}\n` +
            `Duration: ${sTotalDays} Day(s)\n` +
            `Status: ${sStatus}\n` +
            `Reason: ${sReason}`,
            {
                title: "Leave Request Details"
            }
        );
    }

    public onStatusFilterChange(oEvent: InstanceType<typeof Event>): void {
        const oSelect = oEvent.getSource() as InstanceType<typeof Select>;
        const sKey = oSelect.getSelectedKey();
        this.applyStatusFilter(sKey);
        this.updateToolbarVisibility(sKey);
    }

    private applyStatusFilter(sKey: string): void {
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (!oTable) {
            return;
        }

        const oBinding = oTable.getBinding("items");
        if (!oBinding) {
            return;
        }

        const aFilters: InstanceType<typeof Filter>[] = [];
        if (sKey === "SUBMITTED") {
            aFilters.push(new Filter("Status", FilterOperator.EQ, "SUBMITTED"));
        }

        // Clear selection to avoid applying actions on hidden/invalid items
        oTable.removeSelections();
        this.onSelectionChange();

        oBinding.filter(aFilters);
    }

    private updateToolbarVisibility(sKey: string): void {
        const oBtnApprove = this.getView().byId("btnApproveSelected") as InstanceType<typeof Button> | undefined;
        const oBtnReject = this.getView().byId("btnRejectSelected") as InstanceType<typeof Button> | undefined;
        const oBtnDelete = this.getView().byId("btnDeleteSelected") as InstanceType<typeof Button> | undefined;

        const bIsSubmitted = sKey === "SUBMITTED";

        if (oBtnApprove) {
            oBtnApprove.setVisible(bIsSubmitted);
        }
        if (oBtnReject) {
            oBtnReject.setVisible(bIsSubmitted);
        }
        if (oBtnDelete) {
            oBtnDelete.setVisible(!bIsSubmitted);
        }
    }

    public onDeleteSelected(): void {
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (!oTable) { return; }
        const aSelectedItems = oTable.getSelectedItems();
        if (!aSelectedItems || aSelectedItems.length === 0) { return; }

        MessageBox.confirm(
            "Are you sure you want to delete the selected leave request(s)?",
            {
                title: "Delete Leave Requests",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: (sAction?: string) => {
                    if (sAction === MessageBox.Action.YES) {
                        void this._executeDelete(aSelectedItems);
                    }
                }
            }
        );
    }

    private async _executeDelete(aItems: InstanceType<typeof ListItemBase>[]): Promise<void> {
        const oView = this.getView();
        oView.setBusy(true);

        const aPromises = aItems.map((oItem) => {
            const oContext = oItem.getBindingContext();
            if (!oContext) {
                return Promise.resolve({ success: false, uuid: "", error: "No binding context found" });
            }
            const sUuid = oContext.getProperty("UUID") as string;
            return this._deleteRequest(sUuid);
        });

        const aResults = await Promise.all(aPromises);
        oView.setBusy(false);

        const aSuccesses = aResults.filter(r => r.success);
        const aFailures = aResults.filter(r => !r.success);

        // Refresh the model
        const oModel = oView.getModel() as InstanceType<typeof ODataModel> | undefined;
        if (oModel) {
            oModel.refresh(true);
        }

        // Reset table selection & disable buttons
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (oTable) {
            oTable.removeSelections();
        }
        this.onSelectionChange();

        if (aFailures.length === 0) {
            MessageToast.show("Leave request(s) deleted successfully");
        } else {
            const sDetails = aFailures.map(f => f.error).join("\n");
            MessageBox.error(sDetails, {
                title: "Error Deleting Requests"
            });
        }
    }

    private _deleteRequest(sUuid: string): Promise<{ success: boolean; uuid: string; error?: string }> {
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        return new Promise((resolve) => {
            if (!oModel) {
                resolve({ success: false, uuid: sUuid, error: "OData Model is not available" });
                return;
            }
            oModel.remove(`/LeaveRequest(guid'${sUuid}')`, {
                success: () => {
                    resolve({ success: true, uuid: sUuid });
                },
                error: (oError: { responseText?: string; message?: string }) => {
                    let sMsg = "Unknown error";
                    try {
                        if (oError && oError.responseText) {
                            const oParsed = JSON.parse(oError.responseText) as {
                                error?: {
                                    message?: {
                                        value?: string;
                                    };
                                };
                            };
                            sMsg = (oParsed.error && oParsed.error.message && oParsed.error.message.value) || sMsg;
                        } else if (oError && oError.message) {
                            sMsg = oError.message;
                        }
                    } catch (e) {
                        sMsg = (oError && oError.message) || sMsg;
                    }
                    resolve({ success: false, uuid: sUuid, error: sMsg });
                }
            });
        });
    }

    private _getActionName(sActionType: "approve" | "reject"): string {
        const oModel = (this as any).getView().getModel() as any;
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
                                const sTargetName = sActionType === "approve" ? "approveResult" : "rejectResult";
                                const sAltName = sActionType === "approve" ? "approveLeave" : "rejectLeave";
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
        return sActionType === "approve" ? "approveLeave" : "rejectLeave";
    }

    private _callAction(sActionName: string, sUuid: string): Promise<{ success: boolean; uuid: string; error?: string }> {
        const oModel = (this as any).getView().getModel() as any;
        return new Promise((resolve) => {
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
                    } catch (e) {
                        sMsg = (oError && oError.message) || sMsg;
                    }
                    resolve({ success: false, uuid: sUuid, error: sMsg });
                }
            });
        });
    }

    public onApproveSelected(): void {
        this._processMultipleRequests("approve");
    }

    public onRejectSelected(): void {
        this._processMultipleRequests("reject");
    }

    private _processMultipleRequests(sActionType: "approve" | "reject"): void {
        const oTable = (this as any).byId("tableRequests") as any;
        if (!oTable) { return; }
        const aSelectedItems = oTable.getSelectedItems() || [];
        if (aSelectedItems.length === 0) { return; }

        const oResourceBundle = ((this as any).getView().getModel("i18n") as any).getResourceBundle();
        const sActionName = this._getActionName(sActionType);

        // Filter valid requests using the dynamic rule
        const aEligibleItems = aSelectedItems.filter((oItem: any) => {
            const oContext = oItem.getBindingContext();
            if (!oContext) { return false; }

            // Check dynamic action controls, falling back to Status === "SUBMITTED" / "PENDING"
            const bApproveAc = oContext.getProperty("approveLeave_ac") ?? oContext.getProperty("approveResult_ac");
            const bRejectAc = oContext.getProperty("rejectLeave_ac") ?? oContext.getProperty("rejectResult_ac");
            const sStatus = String(oContext.getProperty("Status") || "").toUpperCase();
            const bStatusSubmitted = sStatus === "SUBMITTED" || sStatus === "PENDING";

            if (sActionType === "approve") {
                return bApproveAc !== undefined ? bApproveAc === true : bStatusSubmitted;
            } else {
                return bRejectAc !== undefined ? bRejectAc === true : bStatusSubmitted;
            }
        });

        if (aEligibleItems.length === 0) {
            MessageToast.show("No selected requests are eligible for this action.");
            return;
        }

        const sTitleKey = sActionType === "approve" ? "confirmApproveTitle" : "confirmRejectTitle";
        const sConfirmKey = sActionType === "approve" ? "confirmApproveMultiple" : "confirmRejectMultiple";
        const sConfirmText = oResourceBundle.getText(sConfirmKey, [aEligibleItems.length]);

        const oDlg = new Dialog({
            title: oResourceBundle.getText(sTitleKey),
            type: "Message",
            content: new Label({ text: sConfirmText }),
            beginButton: new Button({
                text: oResourceBundle.getText("yes"),
                press: () => {
                    oDlg.close();
                    void this._executeActionOnItems(sActionType, sActionName, aEligibleItems);
                }
            }),
            endButton: new Button({
                text: oResourceBundle.getText("no"),
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

    private async _executeActionOnItems(sActionType: "approve" | "reject", sActionName: string, aItems: any[]): Promise<void> {
        const oView = (this as any).getView();
        oView.setBusy(true);

        const aPromises = aItems.map((oItem: any) => {
            const oContext = oItem.getBindingContext();
            const sUuid = oContext.getProperty("UUID");
            const sRequestId = oContext.getProperty("RequestId") || "Unknown";
            return this._callAction(sActionName, sUuid).then((oRes) => {
                return { ...oRes, requestId: sRequestId };
            });
        });

        const aResults = await Promise.all(aPromises);
        oView.setBusy(false);

        const aSuccesses = aResults.filter(r => r.success);
        const aFailures = aResults.filter(r => !r.success);

        // Refresh the model
        const oModel = oView.getModel();
        if (oModel) {
            oModel.refresh(true);
        }

        // Reset table selection & disable buttons
        const oTable = (this as any).byId("tableRequests") as any;
        if (oTable) {
            oTable.removeSelections();
        }
        this.onSelectionChange();

        const oResourceBundle = (oView.getModel("i18n") as any).getResourceBundle();

        if (aFailures.length === 0) {
            const sSuccessKey = sActionType === "approve" ? "successApproveMultiple" : "successRejectMultiple";
            const sSuccessMsg = oResourceBundle.getText(sSuccessKey, [aSuccesses.length]);
            MessageToast.show(sSuccessMsg);
        } else {
            // Some or all failed. Format failure details
            const sSuccessKey = sActionType === "approve" ? "successApproveMultiple" : "successRejectMultiple";
            const sSuccessMsg = oResourceBundle.getText(sSuccessKey, [aSuccesses.length]);
            const sErrorSummaryText = oResourceBundle.getText("errorSummaryText");
            const sErrorSummaryTitle = oResourceBundle.getText("errorSummaryTitle");

            const sDetails = aFailures.map(f => `Request ID ${f.requestId}: ${f.error}`).join("\n");
            const sMessage = `${sSuccessMsg}\n\n${sErrorSummaryText}\n${sDetails}`;

            MessageBox.error(sMessage, {
                title: sErrorSummaryTitle
            });
        }
    }

    public onNavToCreate(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("createRequest");
    }

    public onSearch(oEvent: any): void {
        const sQuery: string = (oEvent.getParameter && (oEvent.getParameter("query") || oEvent.getParameter("newValue"))) || "";
        const aTopFilters: any[] = [];

        if (sQuery) {
            // --- 1. Direct OData field filters (RequestId, LeaveType) ---
            const aOrFilters: any[] = [
                new Filter("RequestId", FilterOperator.Contains, sQuery),
                new Filter("LeaveType", FilterOperator.Contains, sQuery)
            ];

            // --- 2. Client-side name lookup: find EmployeeIds whose name matches the query ---
            const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
            const oMap: Record<string, string> | undefined = oUiModel?.getProperty("/employeesMap");
            if (oMap) {
                const sQueryLower = sQuery.toLowerCase();
                Object.entries(oMap).forEach(([sId, sName]: [string, string]) => {
                    if (sName && sName.toLowerCase().includes(sQueryLower)) {
                        // Match by exact EmployeeId (padded or raw)
                        aOrFilters.push(new Filter("EmployeeId", FilterOperator.EQ, sId));
                    }
                });
            }

            aTopFilters.push(new Filter({ filters: aOrFilters, and: false }));
        }

        const oTable = (this as any).byId("tableRequests");
        const oBinding = oTable.getBinding("items");
        oBinding.filter(aTopFilters.length ? aTopFilters : []);
    }

    public onFilter(oEvent: any): void {

        const sValue =
            oEvent.getParameter("query") ||
            oEvent.getParameter("newValue") ||
            "";

        const oTable = this.byId("tableRequests") as InstanceType<typeof Table>;
        const oBinding = oTable.getBinding("items");

        if (!oBinding) {
            return;
        }

        const aFilters: InstanceType<typeof Filter>[] = [];

        if (sValue) {

            const aOrFilters: InstanceType<typeof Filter>[] = [
                new Filter("RequestId", FilterOperator.Contains, sValue),
                new Filter("LeaveType", FilterOperator.Contains, sValue)
            ];

            const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel>;
            const oMap =
                oUiModel.getProperty("/employeesMap") as Record<string, string>;

            const sQueryLower = sValue.toLowerCase();

            Object.entries(oMap || {}).forEach(([sId, sName]) => {

                if (
                    sName &&
                    sName.toLowerCase().includes(sQueryLower)
                ) {

                    const sRawId = String(parseInt(sId, 10));

                    aOrFilters.push(
                        new Filter("EmployeeId", FilterOperator.EQ, sRawId)
                    );
                }
            });

            aFilters.push(
                new Filter({
                    filters: aOrFilters,
                    and: false
                })
            );
        }

        oBinding.filter(aFilters);
    }
    public onRefresh(): void {
        const oModel = (this as any).getView().getModel();
        if (oModel && oModel.refresh) {
            oModel.refresh(true);
            MessageToast.show((this as any).getView().getModel("i18n").getProperty("refreshed"));
        }
    }

    private _updateStatus(sPath: string, sStatus: string): void {
        const oModel = (this as any).getView().getModel();
        const oPayload = { Status: sStatus } as any;
        oModel.update(sPath, oPayload, {
            success: () => {
                MessageToast.show((this as any).getView().getModel("i18n").getProperty("updateSuccess"));
                // refresh app-level stats
                try { (this as any).getView().getModel().refresh(true); } catch { }
            },
            error: () => { MessageToast.show((this as any).getView().getModel("i18n").getProperty("updateError")); }
        });
    }

    public onApprove(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sPath = oContext.getPath();
        const oDlg = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("confirmApproveTitle"),
            type: "Message",
            content: [],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("yes"),
                press: () => {
                    this._updateStatus(sPath, "Approved");
                    oDlg.close();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("no"), press: () => oDlg.close() })
        });
        oDlg.open();
    }

    public onReject(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sPath: string = String(oContext.getPath());
        const oDlg = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("confirmRejectTitle"),
            type: "Message",
            content: [],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("yes"),
                press: () => {
                    this._updateStatus(sPath, "Rejected");
                    oDlg.close();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("no"), press: () => oDlg.close() })
        });
        oDlg.open();
    }

    public onOpenAttachment(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sAttachment = oContext.getProperty("AttachmentURL") as string;

        if (sAttachment) {
            window.open(sAttachment, "_blank");
        } else {
            MessageToast.show(
                (this as any).getView().getModel("i18n").getProperty("noAttachment")
            );
        }
    }

    public onCreate(): void {
        const sViewId = (this as any).getView().getId();
        const oEmpId = new Input(sViewId + "-empId");
        const oEmpName = new Input(sViewId + "-empName");
        const oLeaveType = new Input(sViewId + "-leaveType");
        const oStart = new DatePicker(sViewId + "-start");
        const oEnd = new DatePicker(sViewId + "-end");
        const oReason = new TextArea(sViewId + "-reason");

        const oVBox = new VBox({
            items: [
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("employeeId") }), oEmpId,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("employeeName") }), oEmpName,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("leaveType") }), oLeaveType,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("startDate") }), oStart,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("endDate") }), oEnd,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("reason") }), oReason
            ]
        });

        const oDialog = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("createTitle"),
            content: [oVBox],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("save"),
                press: () => {
                    const oEntry: any = {
                        EmployeeID: oEmpId.getValue(),
                        EmployeeName: oEmpName.getValue(),
                        LeaveType: oLeaveType.getValue(),
                        StartDate: oStart.getDateValue() ? ((oStart.getDateValue() as Date).toISOString()) : null,
                        EndDate: oEnd.getDateValue() ? ((oEnd.getDateValue() as Date).toISOString()) : null,
                        Reason: oReason.getValue(),
                        Status: "Pending"
                    };
                    const oModel = (this as any).getView().getModel();
                    oModel.create("/LeaveRequest", oEntry, {
                        success: () => {
                            MessageToast.show((this as any).getView().getModel("i18n").getProperty("createSuccess"));
                            try { (this as any).getView().getModel().refresh(true); } catch { }
                        },
                        error: () => { MessageToast.show((this as any).getView().getModel("i18n").getProperty("createError")); }
                    });
                    oDialog.close();
                    oDialog.destroy();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("cancel"), press: () => { oDialog.close(); oDialog.destroy(); } }),
            afterClose: () => { oDialog.destroy(); }
        });
        oDialog.open();
    }
}
