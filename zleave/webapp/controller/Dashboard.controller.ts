import Controller from "sap/ui/core/mvc/Controller";

interface LeaveRequest {
    Status?: string;
    TotalDays?: number;
}

interface LeaveRequestResponse {
    results: LeaveRequest[];
}

interface DashboardStats {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    totalDays: number;
}

export default class Dashboard extends Controller {

    public onInit(): void {
        this._loadDashboardStats();
    }

    private _loadDashboardStats(): void {
        const oModel = this.getView().getModel();
        const oUiModel = this.getView().getModel("ui");

        if (!oModel) {
            return;
        }

        oModel.read("/LeaveRequest", {
            success: (oData: LeaveRequestResponse): void => {

                const aResults: LeaveRequest[] = oData.results ?? [];

                const oStats = aResults.reduce<DashboardStats>(
                    (acc, item) => {

                        const sStatus = String(
                            item.Status ?? ""
                        ).toLowerCase();

                        acc.totalRequests += 1;
                        acc.totalDays += Number(item.TotalDays ?? 0);

                        if (sStatus === "approved") {
                            acc.approvedRequests += 1;
                        } else if (sStatus === "rejected") {
                            acc.rejectedRequests += 1;
                        } else {
                            acc.pendingRequests += 1;
                        }

                        return acc;
                    },
                    {
                        totalRequests: 0,
                        pendingRequests: 0,
                        approvedRequests: 0,
                        rejectedRequests: 0,
                        totalDays: 0
                    }
                );

                oUiModel.setProperty("/stats", oStats);
            }
        });
    }
}