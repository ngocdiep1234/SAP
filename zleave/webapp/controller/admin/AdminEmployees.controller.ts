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
export default class AdminEmployees extends Controller {
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
        // Create dialog model
        const oDialogModel = new JSONModel({
            title: "",
            isCreate: true,
            EmployeeId: "",
            SapUser: "",
            FullName: "",
            Email: "",
            Department: "",
            PositionTitle: "",
            ManagerUser: "",
            IsActive: true,
            IsManager: false
        });
        this.getView().setModel(oDialogModel, "dialog");
    }

    public onSearch(oEvent: any): void {
        this._applyFilters();
    }

    public onStatusFilterChange(oEvent: any): void {
        this._applyFilters();
    }

    private _applyFilters(): void {
        const oSearchField = this.getView().byId("searchField") as any;
        const sQuery = oSearchField ? oSearchField.getValue() : "";

        const oStatusFilter = this.getView().byId("statusFilterButton") as any;
        const sStatus = oStatusFilter ? oStatusFilter.getSelectedKey() : "all";

        const oTable = this.getView().byId("tableEmployees") as any;
        const oBinding = oTable ? oTable.getBinding("items") : null;

        if (!oBinding) {
            return;
        }

        const aFilters = [];
        if (sQuery && sQuery.trim().length > 0) {
            aFilters.push(new Filter({
                filters: [
                    new Filter("FullName", FilterOperator.Contains, sQuery),
                    new Filter("SapUser", FilterOperator.Contains, sQuery),
                    new Filter("Department", FilterOperator.Contains, sQuery),
                    new Filter("PositionTitle", FilterOperator.Contains, sQuery)
                ],
                and: false
            }));
        }

        if (sStatus === "active") {
            aFilters.push(new Filter("IsActive", FilterOperator.EQ, true));
        } else if (sStatus === "inactive") {
            aFilters.push(new Filter("IsActive", FilterOperator.EQ, false));
        }

        oBinding.filter(aFilters);
    }

    public onAddEmployee(): void {
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        oDialogModel.setData({
            title: "Add New Employee",
            isCreate: true,
            EmployeeId: "",
            SapUser: "",
            FullName: "",
            Email: "",
            Department: "",
            PositionTitle: "",
            ManagerUser: "",
            IsActive: true,
            IsManager: false
        });

        this._openDialog();
    }

    public onEditEmployee(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }

        const oData = oBindingContext.getObject();
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        oDialogModel.setData({
            title: `Edit Employee (${oData.EmployeeId})`,
            isCreate: false,
            EmployeeId: oData.EmployeeId,
            SapUser: oData.SapUser,
            FullName: oData.FullName,
            Email: oData.Email,
            Department: oData.Department,
            PositionTitle: oData.PositionTitle,
            ManagerUser: oData.ManagerUser,
            IsActive: !!oData.IsActive,
            IsManager: !!oData.IsManager,
            IsHr: !!oData.IsHr,
            IsAdmin: !!oData.IsAdmin
        });

        this._openDialog();
    }

    public onActivateEmployee(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }

        const oData = oBindingContext.getObject();
        const sEmployeeId = oData.EmployeeId;
        const sFullName = oData.FullName;

        MessageBox.confirm(
            `Are you sure you want to activate employee "${sFullName}" (ID: ${sEmployeeId})?`,
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

                        oAdminService.activateEmployee(sEmployeeId)
                            .then((): void => {
                                this.getView().setBusy(false);
                                MessageToast.show("Employee activated successfully.");
                                const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
                                if (oModel) {
                                    oModel.refresh(true);
                                }
                            })
                            .catch((): void => {
                                this.getView().setBusy(false);
                                MessageBox.error("Failed to activate employee. Please try again.");
                            });
                    }
                }
            }
        );
    }

    public onDeactivateEmployee(oEvent: any): void {
        const oButton = oEvent.getSource();
        const oBindingContext = oButton.getBindingContext();
        if (!oBindingContext) {
            return;
        }

        const oData = oBindingContext.getObject();
        const sEmployeeId = oData.EmployeeId;
        const sFullName = oData.FullName;

        MessageBox.confirm(
            `Are you sure you want to deactivate employee "${sFullName}" (ID: ${sEmployeeId})?`,
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

                        oAdminService.deactivateEmployee(sEmployeeId)
                            .then((): void => {
                                this.getView().setBusy(false);
                                MessageToast.show("Employee deactivated successfully.");
                                const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
                                if (oModel) {
                                    oModel.refresh(true);
                                }
                            })
                            .catch((): void => {
                                this.getView().setBusy(false);
                                MessageBox.error("Failed to deactivate employee. Please try again.");
                            });
                    }
                }
            }
        );
    }

    public onSaveDialog(): void {
        const oDialogModel = this.getView().getModel("dialog") as InstanceType<typeof JSONModel>;
        const oData = oDialogModel.getData();

        // Basic Validation
        if (!oData.SapUser || !oData.SapUser.trim()) {
            MessageToast.show("SAP User is required.");
            return;
        }
        if (!oData.FullName || !oData.FullName.trim()) {
            MessageToast.show("Full Name is required.");
            return;
        }

        // Read boolean controls directly from the UI to capture latest state
        const oCbIsManager = this.getView().byId("checkIsManager") as any;
        const bIsManager = oCbIsManager ? oCbIsManager.getSelected() : !!oData.IsManager;
        const bIsActive = !!oData.IsActive;

        const oPayload = {
            SapUser: oData.SapUser.trim(),
            FullName: oData.FullName.trim(),
            Email: oData.Email ? oData.Email.trim() : "",
            Department: oData.Department ? oData.Department.trim() : "",
            PositionTitle: oData.PositionTitle ? oData.PositionTitle.trim() : "",
            ManagerUser: oData.ManagerUser ? oData.ManagerUser.trim() : "",
            IsActive: bIsActive,
            IsManager: bIsManager,
            IsHr: oData.isCreate ? false : !!oData.IsHr,
            IsAdmin: oData.isCreate ? false : !!oData.IsAdmin
        };

        const oAdminService = this._getAdminService();
        if (!oAdminService) {
            return;
        }
        this.getView().setBusy(true);

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;

        if (oData.isCreate) {
            // CREATE
            oAdminService.createEmployee(oPayload)
                .then((): void => {
                    this.getView().setBusy(false);
                    MessageToast.show("Employee created successfully.");
                    if (oModel) {
                        oModel.refresh(true);
                    }
                    this.onCloseDialog();
                })
                .catch((sMsg: string): void => {
                    this.getView().setBusy(false);
                    MessageBox.error(sMsg || "Failed to create employee.");
                });
        } else {
            // UPDATE
            oAdminService.updateEmployee(oData.EmployeeId, oPayload)
                .then((): void => {
                    this.getView().setBusy(false);
                    MessageToast.show("Employee updated successfully.");
                    if (oModel) {
                        oModel.refresh(true);
                    }
                    this.onCloseDialog();
                })
                .catch((sMsg: string): void => {
                    this.getView().setBusy(false);
                    MessageBox.error(sMsg || "Failed to update employee.");
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
                name: "zleave.zleave.view.admin.EmployeeDialog",
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
