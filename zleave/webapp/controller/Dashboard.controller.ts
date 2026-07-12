import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Event from "sap/ui/base/Event";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import ManagedObject from "sap/ui/base/ManagedObject";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

interface LeaveRequest {
    UUID: string;
    RequestId: string;
    LeaveType: string;
    StartDate: Date | string | null;
    EndDate: Date | string | null;
    TotalDays: string | number;
    Status: string;
    Reason?: string;
    ManagerID?: string;
}

interface DashboardStats {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    totalDays: number;
}

interface LeaveQuota {
    LeaveTypeName: string;
    RemainingDays: number;
    UsedDays: number;
    TotalDays: number;
}

interface LeaveQuotaResult {
    results: LeaveQuota[];
}

export default class Dashboard extends Controller {

    public onInit(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("dashboard").attachPatternMatched(this._onPatternMatched, this);
        // Load data immediately in case route was already matched
        // before this controller initialised (first page load).
        this.loadLeaveQuota();
        // NOTE: _loadCurrentUser is called in _onPatternMatched only,
        // to avoid redirecting to admin before the view is stable.
    }

    public loadLeaveQuota(): void {
        const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
        let oQuotaModel = this.getView().getModel("quota") as InstanceType<typeof JSONModel> | undefined;
        if (!oQuotaModel) {
            oQuotaModel = new JSONModel({ results: [] });
            this.getView().setModel(oQuotaModel, "quota");
        }

        if (!oModel) {
            return;
        }

        this.getView().setBusy(true);

        oModel.read("/LeaveQuota", {
            success: (oData: LeaveQuotaResult): void => {
                this.getView().setBusy(false);
                if (oData && oData.results && oData.results.length > 0) {
                    oQuotaModel?.setData(oData);
                } else {
                    oQuotaModel?.setData({ results: [] });
                    MessageBox.warning("No leave balance data available on the backend.");
                }
            },
            error: (oErr: unknown): void => {
                this.getView().setBusy(false);
                console.error("[Dashboard] Failed to load leave quota:", oErr);
                oQuotaModel?.setData({ results: [] });
                MessageBox.error("Failed to load leave quota from backend.");
            }
        });
    }

    private _onPatternMatched(): void {
        const oUiModel = (this as any).getOwnerComponent().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "dashboard");
        }
        void this._loadCurrentUser();
        this.loadLeaveQuota();
    }

    public onNavToCreate(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("createRequest");
    }

    public onNavToRequests(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("requests");
    }

    public onViewRequest(oEvent: any): void {
        const oBindingContext = oEvent.getSource().getParent().getBindingContext("ui");
        if (!oBindingContext) {
            return;
        }
        const oRequest = oBindingContext.getObject() as LeaveRequest;

        MessageBox.information(
            `Request ID: ${oRequest.RequestId}\n` +
            `Type: ${oRequest.LeaveType}\n` +
            `Duration: ${oRequest.TotalDays} Days\n` +
            `Status: ${oRequest.Status}\n` +
            `Reason: ${oRequest.Reason || "No reason provided"}`
        );
    }

    public onEditRequest(oEvent: any): void {
        const oBindingContext = oEvent.getSource().getParent().getBindingContext("ui");
        if (!oBindingContext) {
            return;
        }
        const oRequest = oBindingContext.getObject() as LeaveRequest;
        MessageToast.show(`Opening Draft request ${oRequest.RequestId} for editing...`);

        // Programmatic navigation to Create page
        this.onNavToCreate();
    }

    public onCancelRequest(oEvent: any): void {
        const oBindingContext = oEvent.getSource().getParent().getBindingContext("ui");
        if (!oBindingContext) {
            return;
        }
        const oRequest = oBindingContext.getObject() as LeaveRequest;

        MessageBox.confirm(
            `Are you sure you want to cancel pending request ${oRequest.RequestId}?`,
            {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: (sAction: string) => {
                    if (sAction === MessageBox.Action.YES) {
                        this._cancelODataRequest(oRequest);
                    }
                }
            }
        );
    }

    private _cancelODataRequest(oRequest: LeaveRequest): void {
        const oModel = (this as any).getOwnerComponent().getModel();
        if (!oModel) {
            return;
        }

        this.getView().setBusy(true);

        // Find the OData path. Because we bound from the ui model copy, we locate by UUID.
        // OData path is usually "/LeaveRequest(guid'<UUID>')" or "/LeaveRequest(UUID=guid'<UUID>')"
        const sPath = `/LeaveRequest(guid'${oRequest.UUID}')`;
        const oPayload = { Status: "Cancelled" };

        oModel.update(sPath, oPayload, {
            success: (): void => {
                this.getView().setBusy(false);
                MessageToast.show(`Request ${oRequest.RequestId} cancelled successfully`);
                this.loadLeaveQuota();
            },
            error: (): void => {
                this.getView().setBusy(false);
                MessageBox.error("Failed to cancel the request");
            }
        });
    }

    public onDeleteRequest(oEvent: InstanceType<typeof Event>): void {
        const oSource = oEvent.getSource() as InstanceType<typeof ManagedObject>;
        const oParent = oSource.getParent();
        if (!oParent) {
            return;
        }
        const oBindingContext = oParent.getBindingContext("ui");
        if (!oBindingContext) {
            return;
        }
        const oRequest = oBindingContext.getObject() as LeaveRequest;

        MessageBox.confirm(
            `Are you sure you want to delete leave request ${oRequest.RequestId}?`,
            {
                title: "Delete Leave Request",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: (sAction?: string) => {
                    if (sAction === MessageBox.Action.YES) {
                        this._deleteODataRequest(oRequest);
                    }
                }
            }
        );
    }

    private _deleteODataRequest(oRequest: LeaveRequest): void {
        const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
        if (!oModel) {
            return;
        }

        this.getView().setBusy(true);

        const sPath = `/LeaveRequest(guid'${oRequest.UUID}')`;

        oModel.remove(sPath, {
            success: (): void => {
                this.getView().setBusy(false);
                MessageToast.show(`Request ${oRequest.RequestId} deleted successfully`);
                this.loadLeaveQuota();
            },
            error: (): void => {
                this.getView().setBusy(false);
                MessageBox.error("Failed to delete the request");
            }
        });
    }

    public onTilePress(): void {
        // Handled generic tile click details
    }

    /**
     * Fetch the currently logged-in SAP user from the start_up endpoint
     * and store the result in the "ui" model at /currentUser.
     */
    private async _loadCurrentUser(): Promise<void> {
        const oCurrentUser = await this._getCurrentUser();
        const oRouter = (this as any).getOwnerComponent().getRouter();
        if (oCurrentUser && oCurrentUser.is_admin === "X") {
            oRouter.navTo("AdminDashboard");
        } else if (oCurrentUser && oCurrentUser.is_hr === "X") {
            oRouter.navTo("AdminShell");
        }
    }

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string }> {
        const oComponent = (this as any).getOwnerComponent() as any;
        return oComponent.getCurrentUser();
    }

    /**
     * Ask for confirmation and redirect to the SAP ICF logoff URL.
     */
    public onLogout(): void {
        MessageBox.confirm(
            "Are you sure you want to logout?",
            {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: (sAction: string): void => {
                    if (sAction === MessageBox.Action.YES) {
                        window.location.href = "/sap/public/bc/icf/logoff";
                    }
                }
            }
        );
    }
}