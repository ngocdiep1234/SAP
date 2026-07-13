import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import Fragment from "sap/ui/core/Fragment";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import AdminService from "../../service/AdminService";

/**
 * @namespace zleave.zleave.controller.admin
 */
export default class AdminLeaveTypes extends Controller {
    private _oDialog: any = null;
    private _oAdminService: AdminService;

    private _getAdminService(): AdminService | null {
        if (!this._oAdminService) {
            const oRawModel = (this as any).getOwnerComponent().getModel();
            if (!oRawModel) {
                return null;
            }
            this._oAdminService = new AdminService(
                oRawModel as InstanceType<typeof ODataModel>
            );
        }
        return this._oAdminService;
    }

    public onInit(): void {
        const oDialogModel = new JSONModel({
            title: "",
            isCreate: true,
            LeaveTypeId: "",
            LeaveTypeName: "",
            MaxDaysPerYear: 0,
            RequiresApproval: true,
            IsActive: true
        });
        this.getView().setModel(oDialogModel, "dialog");
    }

    public onSearch(oEvent: any): void {
        const sQuery = oEvent.getParameter("query");
        const oTable = this.getView().byId("tableLeaveTypes") as any;
        const oBinding = oTable.getBinding("items");

        const aFilters = [];
        if (sQuery && sQuery.trim().length > 0) {
            aFilters.push(new Filter({
                filters: [
                    new Filter("LeaveTypeId", FilterOperator.Contains, sQuery),
                    new Filter("LeaveTypeName", FilterOperator.Contains, sQuery)
                ],
                and: false
            }));
        }
        oBinding.filter(aFilters);
    }

    public onAddLeaveType(): void {
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        oDialogModel.setData({
            title: "Add New Leave Type",
            isCreate: true,
            LeaveTypeId: "",
            LeaveTypeName: "",
            MaxDaysPerYear: 12,
            RequiresApproval: true,
            IsActive: true
        });
        this._openDialog();
    }

    public onEditLeaveType(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }

        const oData = oBindingContext.getObject();
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        oDialogModel.setData({
            title: `Edit Leave Type (${oData.LeaveTypeId})`,
            isCreate: false,
            LeaveTypeId: oData.LeaveTypeId,
            LeaveTypeName: oData.LeaveTypeName,
            MaxDaysPerYear: oData.MaxDaysPerYear ? parseFloat(oData.MaxDaysPerYear) : 0,
            RequiresApproval: !!oData.RequiresApproval,
            IsActive: !!oData.IsActive
        });
        this._openDialog();
    }

    public onActivateLeaveType(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }

        const oData = oBindingContext.getObject();
        const sLeaveTypeId = oData.LeaveTypeId;
        const sLeaveTypeName = oData.LeaveTypeName;

        MessageBox.confirm(
            `Are you sure you want to activate leave type "${sLeaveTypeName}" (${sLeaveTypeId})?`,
            {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: (sAction: string) => {
                    if (sAction === MessageBox.Action.YES) {
                        const oAdminService = this._getAdminService();
                        if (!oAdminService) {
                            return;
                        }
                        this.getView().setBusy(true);

                        oAdminService.activateLeaveType(sLeaveTypeId)
                            .then((): void => {
                                this.getView().setBusy(false);
                                MessageToast.show("Leave Type activated successfully.");
                                const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
                                if (oModel) {
                                    oModel.refresh(true);
                                }
                            })
                            .catch((): void => {
                                this.getView().setBusy(false);
                                MessageBox.error("Failed to activate Leave Type. Please try again.");
                            });
                    }
                }
            }
        );
    }

    public onDeactivateLeaveType(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }

        const oData = oBindingContext.getObject();
        const sLeaveTypeId = oData.LeaveTypeId;
        const sLeaveTypeName = oData.LeaveTypeName;

        MessageBox.confirm(
            `Are you sure you want to deactivate leave type "${sLeaveTypeName}" (${sLeaveTypeId})?`,
            {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: (sAction: string) => {
                    if (sAction === MessageBox.Action.YES) {
                        const oAdminService = this._getAdminService();
                        if (!oAdminService) {
                            return;
                        }
                        this.getView().setBusy(true);

                        oAdminService.deactivateLeaveType(sLeaveTypeId)
                            .then((): void => {
                                this.getView().setBusy(false);
                                MessageToast.show("Leave Type deactivated successfully.");
                                const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
                                if (oModel) {
                                    oModel.refresh(true);
                                }
                            })
                            .catch((): void => {
                                this.getView().setBusy(false);
                                MessageBox.error("Failed to deactivate Leave Type. Please try again.");
                            });
                    }
                }
            }
        );
    }

    public onSaveDialog(): void {
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        const oData = oDialogModel.getData();

        if (oData.isCreate && (!oData.LeaveTypeId || !oData.LeaveTypeId.trim())) {
            MessageToast.show("Leave Type ID is required.");
            return;
        }
        if (oData.isCreate && oData.LeaveTypeId.trim().length > 5) {
            MessageToast.show("Leave Type ID must be at most 5 characters.");
            return;
        }
        if (!oData.LeaveTypeName || !oData.LeaveTypeName.trim()) {
            MessageToast.show("Leave Type Name is required.");
            return;
        }

        const oCbRequiresApproval = this.getView().byId("checkRequiresApproval") as any;
        const oSwActive = this.getView().byId("switchActive") as any;
        const bRequiresApproval = oCbRequiresApproval ? oCbRequiresApproval.getSelected() : !!oData.RequiresApproval;
        const bIsActive = oSwActive ? oSwActive.getState() : !!oData.IsActive;

        let sMaxDays = "0.00";
        if (oData.MaxDaysPerYear !== undefined && oData.MaxDaysPerYear !== null) {
            const nMaxDays = parseFloat(oData.MaxDaysPerYear);
            if (isNaN(nMaxDays)) {
                MessageToast.show("Max Days Per Year must be a valid number.");
                return;
            }
            sMaxDays = nMaxDays.toFixed(2);
        }

        const oPayload = {
            LeaveTypeId: oData.LeaveTypeId.trim(),
            LeaveTypeName: oData.LeaveTypeName.trim(),
            MaxDaysPerYear: sMaxDays,
            RequiresApproval: bRequiresApproval,
            IsActive: bIsActive
        };

        const oAdminService = this._getAdminService();
        if (!oAdminService) {
            return;
        }
        this.getView().setBusy(true);

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;

        if (oData.isCreate) {
            oAdminService.createLeaveType(oPayload)
                .then((): void => {
                    this.getView().setBusy(false);
                    MessageToast.show("Leave Type created successfully.");
                    if (oModel) {
                        oModel.refresh(true);
                    }
                    this.onCloseDialog();
                })
                .catch((sMsg: string): void => {
                    this.getView().setBusy(false);
                    MessageBox.error(sMsg || "Failed to create Leave Type.");
                });
        } else {
            oAdminService.updateLeaveType(oData.LeaveTypeId, oPayload)
                .then((): void => {
                    this.getView().setBusy(false);
                    MessageToast.show("Leave Type updated successfully.");
                    if (oModel) {
                        oModel.refresh(true);
                    }
                    this.onCloseDialog();
                })
                .catch((sMsg: string): void => {
                    this.getView().setBusy(false);
                    MessageBox.error(sMsg || "Failed to update Leave Type.");
                });
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
                name: "zleave.zleave.view.admin.LeaveTypeDialog",
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
