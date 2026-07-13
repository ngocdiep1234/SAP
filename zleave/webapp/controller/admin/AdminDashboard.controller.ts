import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Sorter from "sap/ui/model/Sorter";
import AdminService from "../../service/AdminService";

/**
 * @namespace zleave.zleave.controller.admin
 */
export default class AdminDashboard extends Controller {

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
        const oDashboardModel = new JSONModel({
            recentActivities: []
        });
        this.getView().setModel(oDashboardModel, "dashboard");

        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("AdminDashboard").attachPatternMatched(this._onPatternMatched, this);
        oRouter.getRoute("AdminShell").attachPatternMatched(this._onPatternMatched, this);

        // Load data immediately for the initial route entry
        this._loadRecentActivities();
    }

    private _onPatternMatched(): void {
        void this._getCurrentUser();
        this._loadRecentActivities();
    }

    private _loadRecentActivities(): void {
        const oAdminService = this._getAdminService();
        if (!oAdminService) {
            // Context/model might not be loaded yet during first onInit lifecycle step
            this.getView().attachEventOnce("modelContextChange", () => {
                this._loadRecentActivities();
            });
            return;
        }

        oAdminService.readAuditLogs({
            urlParameters: {
                "$top": "3"
            },
            sorters: [
                new Sorter("ActionAt", true)
            ]
        })
        .then((aResults) => {
            const aActivities = aResults.map((item: any) => {
                let sIcon = "sap-icon://activity-items";
                let sState = "None";
                const sAct = String(item.Action || "").toLowerCase();
                if (sAct.includes("create")) {
                    sIcon = "sap-icon://add-employee";
                    sState = "Success";
                } else if (sAct.includes("activate")) {
                    sIcon = "sap-icon://accept";
                    sState = "Success";
                } else if (sAct.includes("deactivate")) {
                    sIcon = "sap-icon://decline";
                    sState = "Error";
                } else if (sAct.includes("approve")) {
                    sIcon = "sap-icon://sys-enter-2";
                    sState = "Success";
                } else if (sAct.includes("reject")) {
                    sIcon = "sap-icon://sys-cancel-2";
                    sState = "Error";
                } else if (sAct.includes("update")) {
                    sIcon = "sap-icon://edit";
                    sState = "Information";
                }

                const sBy = item.ActionBy || "System";
                const sAction = item.Action || "Activity";
                const sTarget = item.EmployeeId ? ` for Employee ${item.EmployeeId}` : "";
                const sCommentStr = item.Comments ? ` (${item.Comments})` : "";
                const sText = `${sBy} performed ${sAction}${sTarget}${sCommentStr}`;

                let sTimeStr = "";
                if (item.ActionAt instanceof Date) {
                    sTimeStr = item.ActionAt.toLocaleString();
                } else if (item.ActionAt) {
                    sTimeStr = String(item.ActionAt);
                }

                return {
                    text: sText,
                    time: sTimeStr,
                    icon: sIcon,
                    state: sState
                };
            });

            const oDashboardModel = this.getView().getModel("dashboard") as InstanceType<typeof JSONModel>;
            if (oDashboardModel) {
                oDashboardModel.setProperty("/recentActivities", aActivities);
            }
        })
        .catch((oErr) => {
            console.error("Failed to load audit logs for dashboard", oErr);
        });
    }

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string; accessRolesText?: string }> {
        const oComponent = (this as any).getOwnerComponent() as any;
        return oComponent.getCurrentUser();
    }

    public onNavToEmployees(): void {
        const oRouter = (this.getOwnerComponent() as any).getRouter();
        oRouter.navTo("AdminEmployees");
    }

    public onNavToLeaveRequests(): void {
        const oRouter = (this.getOwnerComponent() as any).getRouter();
        oRouter.navTo("AdminLeaveRequests");
    }

    public onNavToQuota(): void {
        const oRouter = (this.getOwnerComponent() as any).getRouter();
        oRouter.navTo("QuotaManagement");
    }

    public onNavToLeaveTypes(): void {
        const oRouter = (this.getOwnerComponent() as any).getRouter();
        oRouter.navTo("AdminLeaveTypes");
    }
}
