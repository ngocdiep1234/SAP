import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Sorter from "sap/ui/model/Sorter";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";

/**
 * @namespace zleave.zleave.controller.admin
 */
export default class AdminDashboard extends Controller {
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
        const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
        if (!oModel) {
            // Context/model might not be loaded yet during first onInit lifecycle step
            this.getView().attachEventOnce("modelContextChange", () => {
                this._loadRecentActivities();
            });
            return;
        }

        oModel.read("/AuditLog", {
            urlParameters: {
                "$top": "3"
            },
            sorters: [
                new Sorter("ActionAt", true)
            ],
            success: (oData: any) => {
                const aResults = oData.results || [];
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
            },
            error: (oErr: any) => {
                console.error("Failed to load audit logs for dashboard", oErr);
            }
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
