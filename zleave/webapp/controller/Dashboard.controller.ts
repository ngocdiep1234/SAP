import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";

interface LeaveRequest {
    UUID: string;
    RequestID: string;
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

export default class Dashboard extends Controller {

    public onInit(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("dashboard").attachPatternMatched(this._onPatternMatched, this);
    }

    private _onPatternMatched(): void {
        const oUiModel = this.getView().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "dashboard");
        }
        this._loadDashboardData();
        void this._loadCurrentUser();
    }

    private _loadDashboardData(): void {
        const oModel = this.getView().getModel();
        const oUiModel = this.getView().getModel("ui") as any;

        if (!oModel || !oUiModel) {
            return;
        }

        this.getView().setBusy(true);

        oModel.read("/LeaveRequest", {
            success: (oData: any): void => {
                this.getView().setBusy(false);
                const aResults: LeaveRequest[] = oData.results ?? [];

                // 1. Calculate stats
                const oStats = aResults.reduce<DashboardStats>(
                    (acc, item) => {
                        const sStatus = String(item.Status ?? "").toLowerCase();
                        acc.totalRequests += 1;
                        acc.totalDays += Number(item.TotalDays ?? 0);

                        if (sStatus === "approved") {
                            acc.approvedRequests += 1;
                        } else if (sStatus === "rejected") {
                            acc.rejectedRequests += 1;
                        } else if (sStatus === "pending") {
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

                // 2. Calculate balances
                let nAnnualUsed = 0;
                let nSickUsed = 0;
                let nUnpaidUsed = 0;

                aResults.forEach((oReq) => {
                    if (oReq.Status === "Approved") {
                        const nDays = Number(oReq.TotalDays ?? 0);
                        const sType = String(oReq.LeaveType).toLowerCase();
                        if (sType.includes("annual")) {
                            nAnnualUsed += nDays;
                        } else if (sType.includes("sick")) {
                            nSickUsed += nDays;
                        } else if (sType.includes("unpaid")) {
                            nUnpaidUsed += nDays;
                        }
                    }
                });

                const nAnnualRemaining = Math.max(0, 12 - nAnnualUsed);
                const nSickRemaining = Math.max(0, 8 - nSickUsed);

                oUiModel.setProperty("/dashboard", {
                    annualLeaveRemaining: nAnnualRemaining,
                    sickLeaveRemaining: nSickRemaining,
                    unpaidLeaveUsed: nUnpaidUsed,
                    myRequests: aResults.slice(0, 6), // Show top 6 recent requests
                    upcomingLeaves: aResults.filter(r => r.Status === "Approved").slice(0, 4), // Top 4 approved
                    notifications: [
                        { icon: "sap-icon://accept", state: "Success", message: "Annual Leave request R0001 approved", time: "2 hours ago" },
                        { icon: "sap-icon://decline", state: "Error", message: "Sick Leave request R0002 rejected", time: "5 hours ago" },
                        { icon: "sap-icon://sys-enter-2", state: "Information", message: "System leave balance initialized", time: "Yesterday" }
                    ]
                });
            },
            error: (): void => {
                this.getView().setBusy(false);
                MessageToast.show("Failed to load dashboard data");
            }
        });
    }

    public onNavToCreate(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("createRequest");
    }

    public onNavToRequests(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("requests");
    }

    public onNavToCalendar(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("analytics");
    }

    public onViewRequest(oEvent: any): void {
        const oBindingContext = oEvent.getSource().getParent().getBindingContext("ui");
        if (!oBindingContext) {
            return;
        }
        const oRequest = oBindingContext.getObject() as LeaveRequest;
        
        MessageBox.information(
            `Request ID: ${oRequest.RequestID}\n` +
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
        MessageToast.show(`Opening Draft request ${oRequest.RequestID} for editing...`);
        
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
            `Are you sure you want to cancel pending request ${oRequest.RequestID}?`,
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
        const oModel = this.getView().getModel();
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
                MessageToast.show(`Request ${oRequest.RequestID} cancelled successfully`);
                this._loadDashboardData();
            },
            error: (): void => {
                this.getView().setBusy(false);
                MessageBox.error("Failed to cancel the request");
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
        const oUiModel = this.getView()?.getModel("ui") as any;
        if (!oUiModel) {
            return;
        }

        // Initialise with a fallback while loading
        oUiModel.setProperty("/currentUser", { id: "", displayName: "Unknown User" });

        try {
            const oResponse = await fetch("/sap/bc/ui2/start_up", {
                credentials: "same-origin"
            });

            if (!oResponse.ok) {
                return; // keep fallback
            }

            const oData: Record<string, unknown> = await oResponse.json() as Record<string, unknown>;

            // The start_up response may expose the user under different keys
            // depending on the ABAP system version.
            const sId: string =
                (oData["id"] as string) ??
                (oData["userId"] as string) ??
                (oData["name"] as string) ??
                "";

            const sFullName: string =
                (oData["fullName"] as string) ??
                (oData["displayName"] as string) ??
                sId;

            const sDisplayName = sFullName || sId || "Unknown User";

            oUiModel.setProperty("/currentUser", {
                id: sId,
                displayName: sDisplayName
            });
        } catch {
            // Network error or JSON parse error – keep the fallback
        }
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