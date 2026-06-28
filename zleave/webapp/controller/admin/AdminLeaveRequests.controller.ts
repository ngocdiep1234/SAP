import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import Fragment from "sap/ui/core/Fragment";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";

/**
 * @namespace zleave.zleave.controller.admin
 */
export default class AdminLeaveRequests extends Controller {
    private _oDialog: any = null;

    public onInit(): void {
        const oDialogModel = new JSONModel({
            title: "",
            UUID: "",
            LeaveType: "",
            StartDate: null,
            StartSession: "",
            EndDate: null,
            EndSession: "",
            TotalDays: 0,
            Reason: "",
            Status: "",
            ApprovalComment: ""
        });
        this.getView().setModel(oDialogModel, "dialog");
    }

    public formatEmployeeName(sFullName: string, sEmployeeId: string): string {
        if (sFullName) {
            return `${sFullName} (${sEmployeeId})`;
        }
        return sEmployeeId || "";
    }

    public onSearch(oEvent: any): void {
        const sQuery = oEvent.getParameter("query");
        const oTable = this.getView().byId("tableRequests") as any;
        const oBinding = oTable.getBinding("items");

        const aFilters = [];
        if (sQuery && sQuery.trim().length > 0) {
            aFilters.push(new Filter({
                filters: [
                    new Filter("RequestId", FilterOperator.Contains, sQuery),
                    new Filter("EmployeeId", FilterOperator.Contains, sQuery),
                    new Filter("LeaveType", FilterOperator.Contains, sQuery),
                    new Filter("Status", FilterOperator.Contains, sQuery),
                    new Filter("Reason", FilterOperator.Contains, sQuery)
                ],
                and: false
            }));
        }
        oBinding.filter(aFilters);
    }

    public onViewDetail(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }
        const sUuid = oBindingContext.getProperty("UUID");
        const oRouter = (this.getOwnerComponent() as any).getRouter();
        oRouter.navTo("requestDetail", {
            uuid: sUuid
        });
    }

    public onEditRequest(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }

        const oData = oBindingContext.getObject();
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        
        oDialogModel.setData({
            title: `Edit Leave Request (${oData.RequestId})`,
            UUID: oData.UUID,
            LeaveType: oData.LeaveType,
            StartDate: oData.StartDate ? new Date(oData.StartDate) : null,
            StartSession: oData.StartSession || "",
            EndDate: oData.EndDate ? new Date(oData.EndDate) : null,
            EndSession: oData.EndSession || "",
            TotalDays: oData.TotalDays ? Number(oData.TotalDays) : 0,
            Reason: oData.Reason || "",
            Status: oData.Status || "",
            ApprovalComment: oData.ApprovalComment || ""
        });

        this._openDialog();
    }

    public onDeleteRequest(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }

        const oData = oBindingContext.getObject();
        const sUuid = oData.UUID;
        const sRequestId = oData.RequestId;

        MessageBox.confirm(
            `Are you sure you want to delete leave request "${sRequestId}"?`,
            {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: (sAction: string) => {
                    if (sAction === MessageBox.Action.YES) {
                        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
                        this.getView().setBusy(true);

                        oModel.remove(`/LeaveRequestAdmin(guid'${sUuid}')`, {
                            success: () => {
                                this.getView().setBusy(false);
                                MessageToast.show("Leave request deleted successfully.");
                            },
                            error: (oErr: any) => {
                                this.getView().setBusy(false);
                                let sMsg = "Failed to delete request.";
                                try {
                                    const oResponse = JSON.parse(oErr.responseText);
                                    if (oResponse?.error?.message?.value) {
                                        sMsg = oResponse.error.message.value;
                                    }
                                } catch (e) {
                                    // ignore
                                }
                                MessageBox.error(sMsg);
                            }
                        });
                    }
                }
            }
        );
    }

    public onDatesChange(): void {
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        const dStart = oDialogModel.getProperty("/StartDate") as Date | null;
        const dEnd = oDialogModel.getProperty("/EndDate") as Date | null;
        const sStartSession = oDialogModel.getProperty("/StartSession") || "";
        const sEndSession = oDialogModel.getProperty("/EndSession") || "";

        if (!dStart || !dEnd) {
            return;
        }

        if (dEnd < dStart) {
            oDialogModel.setProperty("/TotalDays", 0);
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

        oDialogModel.setProperty("/TotalDays", nDays);
    }

    public onSaveDialog(): void {
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        const oData = oDialogModel.getData();

        // Basic Validation
        if (!oData.LeaveType) {
            MessageToast.show("Leave Type is required.");
            return;
        }
        if (!oData.StartDate) {
            MessageToast.show("Start Date is required.");
            return;
        }
        if (!oData.EndDate) {
            MessageToast.show("End Date is required.");
            return;
        }
        if (oData.EndDate < oData.StartDate) {
            MessageToast.show("End Date cannot be before Start Date.");
            return;
        }
        if (!oData.Reason || !oData.Reason.trim()) {
            MessageToast.show("Reason is required.");
            return;
        }
        if (oData.TotalDays <= 0) {
            MessageToast.show("Total Days must be greater than 0.");
            return;
        }

        const oPayload = {
            LeaveType: oData.LeaveType,
            StartDate: oData.StartDate,
            EndDate: oData.EndDate,
            StartSession: oData.StartSession || "",
            EndSession: oData.EndSession || "",
            TotalDays: String(oData.TotalDays),
            Reason: oData.Reason.trim(),
            Status: oData.Status,
            ApprovalComment: oData.ApprovalComment ? oData.ApprovalComment.trim() : ""
        };

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        this.getView().setBusy(true);

        oModel.update(`/LeaveRequestAdmin(guid'${oData.UUID}')`, oPayload, {
            success: () => {
                this.getView().setBusy(false);
                MessageToast.show("Leave request updated successfully.");
                this.onCloseDialog();
                oModel.refresh(true);
            },
            error: (oErr: any) => {
                this.getView().setBusy(false);
                let sMsg = "Failed to update leave request.";
                try {
                    const oResponse = JSON.parse(oErr.responseText);
                    if (oResponse?.error?.message?.value) {
                        sMsg = oResponse.error.message.value;
                    }
                } catch (e) {
                    // ignore
                }
                MessageBox.error(sMsg);
            }
        });
    }

    public onRefresh(): void {
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        if (oModel) {
            oModel.refresh(true);
            MessageToast.show("Refreshed");
        }
    }

    public onCloseDialog(): void {
        if (this._oDialog) {
            this._oDialog.close();
        }
    }

    private _openDialog(): void {
        if (!this._oDialog) {
            Fragment.load({
                id: this.getView().getId(),
                name: "zleave.zleave.view.admin.LeaveRequestDialog",
                controller: this
            }).then((oDialog: any) => {
                this._oDialog = oDialog;
                this.getView().addDependent(this._oDialog);
                this._oDialog.open();
            });
        } else {
            this._oDialog.open();
        }
    }
}
