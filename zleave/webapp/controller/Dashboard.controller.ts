import Controller from "sap/ui/core/mvc/Controller";

export default class Dashboard extends Controller {

    public onInit(): void {
        // load dashboard stats when dashboard view initializes
        this._loadDashboardStats();
    }

    private _loadDashboardStats(): void {
        const oModel = (this as any).getView().getModel();
        const oUiModel = (this as any).getView().getModel("ui") as any;

        if (!oModel || !(oModel as any).read) {
            return;
        }

        (oModel as any).read("/LeaveRequest", {
            success: (oData: any) => {
                const aResults = oData && oData.results ? oData.results : [];
                const oStats = aResults.reduce((acc: any, item: any) => {
                    const sStatus = String(item.Status || "").toLowerCase();
                    acc.totalRequests += 1;
                    acc.totalDays += Number(item.TotalDays || 0);
                    if (sStatus === "approved") {
                        acc.approvedRequests += 1;
                    } else if (sStatus === "rejected") {
                        acc.rejectedRequests += 1;
                    } else {
                        acc.pendingRequests += 1;
                    }
                    return acc;
                }, {
                    totalRequests: 0,
                    pendingRequests: 0,
                    approvedRequests: 0,
                    rejectedRequests: 0,
                    totalDays: 0
                });

                oUiModel.setProperty("/stats", oStats);
            }
        });
    }
}
