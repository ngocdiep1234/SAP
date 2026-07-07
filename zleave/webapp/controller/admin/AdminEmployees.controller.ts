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
export default class AdminEmployees extends Controller {
    private _oDialog: any = null;

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
        const sQuery = oEvent.getParameter("query");
        const oTable = this.getView().byId("tableEmployees") as any;
        const oBinding = oTable.getBinding("items");

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
                        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
                        this.getView().setBusy(true);

                        oModel.callFunction("/activate", {
                            method: "POST",
                            urlParameters: {
                                EmployeeId: sEmployeeId
                            },
                            success: () => {
                                this.getView().setBusy(false);
                                MessageToast.show("Employee activated successfully.");
                                oModel.refresh(true);
                            },
                            error: (oErr: any) => {
                                this.getView().setBusy(false);
                                MessageBox.error("Failed to activate employee. Please try again.");
                            }
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
                        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
                        this.getView().setBusy(true);

                        oModel.callFunction("/deactivate", {
                            method: "POST",
                            urlParameters: {
                                EmployeeId: sEmployeeId
                            },
                            success: () => {
                                this.getView().setBusy(false);
                                MessageToast.show("Employee deactivated successfully.");
                                oModel.refresh(true);
                            },
                            error: (oErr: any) => {
                                this.getView().setBusy(false);
                                MessageBox.error("Failed to deactivate employee. Please try again.");
                            }
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

        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        this.getView().setBusy(true);

        if (oData.isCreate) {
            // CREATE
            oModel.create("/EmployeeAdmin", oPayload, {
                success: () => {
                    this.getView().setBusy(false);
                    MessageToast.show("Employee created successfully.");
                    oModel.refresh(true);
                    this.onCloseDialog();
                },
                error: (oErr: any) => {
                    this.getView().setBusy(false);
                    let sMsg = "Failed to create employee.";
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
        } else {
            // UPDATE
            oModel.update(`/EmployeeAdmin(EmployeeId='${oData.EmployeeId}')`, oPayload, {
                success: () => {
                    this.getView().setBusy(false);
                    MessageToast.show("Employee updated successfully.");
                    oModel.refresh(true);
                    this.onCloseDialog();
                },
                error: (oErr: any) => {
                    this.getView().setBusy(false);
                    let sMsg = "Failed to update employee.";
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
