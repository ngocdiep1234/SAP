import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Sorter from "sap/ui/model/Sorter";
import MessageBox from "sap/m/MessageBox";

/**
 * @namespace zleave.zleave.controller.admin
 */
export default class AdminAuditLogDetail extends Controller {

    public onInit(): void {
        const oTimelineModel = new JSONModel({ results: [] });
        this.getView().setModel(oTimelineModel, "timeline");

        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("AdminAuditLogDetail").attachPatternMatched(this._onPatternMatched, this);
    }

    private async _onPatternMatched(oEvent: any): Promise<void> {
        const oArgs = oEvent.getParameter("arguments") as { logId: string };
        const sLogId = oArgs.logId;

        const oUiModel = (this as any).getOwnerComponent().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "audit");
        }

        this.getView().setBusy(true);

        try {
            // Role verification
            const oCurrentUser = await this._getCurrentUser();
            const bIsAdmin = oCurrentUser && (oCurrentUser.is_admin === "X" || oCurrentUser.is_admin === "true" || oCurrentUser.is_admin === "1");
            const bIsHr = oCurrentUser && (oCurrentUser.is_hr === "X" || oCurrentUser.is_hr === "true" || oCurrentUser.is_hr === "1");
            if (!bIsAdmin && !bIsHr) {
                const oRouter = (this as any).getOwnerComponent().getRouter();
                oRouter.navTo("Unauthorized");
                return;
            }

            // Bind log entity
            const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
            if (!oModel) {
                return;
            }

            const sPath = `/AuditLog(guid'${sLogId}')`;
            this.getView().bindElement({
                path: sPath,
                events: {
                    dataReceived: (oDataEvent: any) => {
                        this.getView().setBusy(false);
                        const oData = oDataEvent.getParameter("data");
                        if (!oData) {
                            MessageBox.error("Requested audit log could not be found.");
                            return;
                        }
                        const sRequestId = oData.RequestId;
                        if (sRequestId) {
                            this._loadTimelineData(sRequestId);
                        }
                    },
                    change: () => {
                        // In case element is bound from cache
                        const oContext = this.getView().getBindingContext();
                        if (oContext) {
                            this.getView().setBusy(false);
                            const sRequestId = String(oContext.getProperty("RequestId") || "");
                            if (sRequestId) {
                                this._loadTimelineData(sRequestId);
                            }
                        }
                    }
                }
            });

        } catch (oErr) {
            this.getView().setBusy(false);
            console.error("[AdminAuditLogDetail] Loading failed:", oErr);
            MessageBox.error("Failed to load details due to OData error.");
        }
    }

    private _loadTimelineData(sRequestId: string): void {
        const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
        const oTimelineModel = this.getView().getModel("timeline") as InstanceType<typeof JSONModel> | undefined;
        if (!oModel || !oTimelineModel) {
            return;
        }

        oModel.read("/AuditLog", {
            filters: [
                new Filter("RequestId", FilterOperator.EQ, sRequestId)
            ],
            sorters: [
                new Sorter("ActionAt", true) // Descending (latest action first)
            ],
            success: (oData: any) => {
                if (oData && oData.results) {
                    oTimelineModel.setData(oData);
                } else {
                    oTimelineModel.setData({ results: [] });
                }
            },
            error: (oErr: any) => {
                console.error("[AdminAuditLogDetail] Failed to load timeline data:", oErr);
                oTimelineModel.setData({ results: [] });
            }
        });
    }

    public onNavBack(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("AdminAuditLog");
    }

    // Formatters
    public formatActionState(sAction: string, vCriticality: any): string {
        if (vCriticality !== null && vCriticality !== undefined && vCriticality !== "") {
            const nCriticality = Number(vCriticality);
            if (nCriticality === 1) return "Error";
            if (nCriticality === 2) return "Warning";
            if (nCriticality === 3) return "Success";
            if (nCriticality === 5) return "Information";
            return "None";
        }
        if (!sAction) {
            return "None";
        }
        const sActLower = sAction.toLowerCase();
        if (sActLower.includes("create") || sActLower.includes("activate") || sActLower.includes("approve")) {
            return "Success";
        }
        if (sActLower.includes("deactivate") || sActLower.includes("reject")) {
            return "Error";
        }
        if (sActLower.includes("update")) {
            return "Information";
        }
        if (sActLower.includes("cancel")) {
            return "Warning";
        }
        return "None";
    }

    public formatStatusState(sStatus: string): string {
        if (!sStatus) {
            return "None";
        }
        const sStatLower = sStatus.toLowerCase();
        if (sStatLower === "approved" || sStatLower === "mgr_approved") {
            return "Success";
        }
        if (sStatLower === "rejected") {
            return "Error";
        }
        if (sStatLower === "submitted" || sStatLower === "pending") {
            return "Warning";
        }
        return "None";
    }

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string }> {
        const oComponent = (this as any).getOwnerComponent() as any;
        return oComponent.getCurrentUser();
    }
}
