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
        this._loadDashboardData();
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
                if (oData && oData.results) {
                    oQuotaModel?.setData(oData);
                } else {
                    oQuotaModel?.setData({ results: [] });
                }
            },
            error: (oErr: unknown): void => {
                this.getView().setBusy(false);
                console.error("[Dashboard] Failed to load leave quota:", oErr);
                oQuotaModel?.setData({ results: [] });
            }
        });
    }

    private _onPatternMatched(): void {
        const oUiModel = (this as any).getOwnerComponent().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "dashboard");
        }
        this._loadDashboardData();
        void this._loadCurrentUser();
        this.loadLeaveQuota();
    }

    private _loadDashboardData(): void {
        const oModel = (this as any).getOwnerComponent().getModel();
        // Retrieve "ui" model from the Component (set by App.controller.ts).
        // This is reliable even before the Dashboard view is inserted into
        // the App NavContainer (i.e. during onInit on first page load).
        const oUiModel = (this as any).getOwnerComponent().getModel("ui") as any;

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
                this._loadDashboardData();
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
                this._loadDashboardData();
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
        const oUiModel = (this as any).getOwnerComponent().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (!oUiModel) {
            return { registered: true, employeeId: "1001", employeeName: "Nguyen Van A", role: "Employee", is_manager: "", is_hr: "", is_admin: "" };
        }

        const oCachedUser = oUiModel.getProperty("/currentUser") as any;
        if (oCachedUser && oCachedUser.employeeId && oCachedUser.role) {
            console.log("[DEBUG] Current user from cache:", oCachedUser);
            return oCachedUser as { registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string };
        }

        let sSapUser = oCachedUser?.id as string | undefined;

        // Try to fetch current SAP user id if not cached
        if (!sSapUser) {
            try {
                const oResponse = await fetch("/sap/bc/ui2/start_up", {
                    credentials: "same-origin"
                });
                if (oResponse.ok) {
                    const oData = await oResponse.json() as Record<string, unknown>;
                    sSapUser = (oData["id"] as string) ??
                        (oData["userId"] as string) ??
                        (oData["name"] as string) ??
                        "";
                }
            } catch (oErr) {
                console.error("[Dashboard] fetch /sap/bc/ui2/start_up failed:", oErr);
            }
        }

        if (sSapUser) {
            const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
            if (oModel) {
                try {
                    const oResult = await new Promise<any>((resolve, reject) => {
                        oModel.read("/Employee", {
                            filters: [
                                new Filter("SapUserName", FilterOperator.EQ, sSapUser)
                            ],
                            success: (oDataSuccess: any) => resolve(oDataSuccess),
                            error: (oError: any) => reject(oError)
                        });
                    });
                    if (oResult && oResult.results && oResult.results.length > 0) {
                        const oEmp = oResult.results[0];
                        const oUserObj = {
                            registered: true,
                            employeeId: String(oEmp["EmployeeId"] ?? ""),
                            employeeName: String(oEmp["FullName"] ?? oEmp["SapUserName"] ?? ""),
                            id: sSapUser,
                            displayName: String(oEmp["FullName"] ?? oEmp["SapUserName"] ?? ""),
                            role: String(oEmp["PositionTitle"] ?? "Employee"),
                            is_manager: String(oEmp["IsManager"] ?? ""),
                            is_hr: String(oEmp["IsHR"] ?? ""),
                            is_admin: String(oEmp["IsAdmin"] ?? "")
                        };
                        oUiModel.setProperty("/currentUser", oUserObj);
                        console.log("[DEBUG] Current user loaded from Employee query:", oUserObj);
                        return oUserObj;
                    }
                } catch (oErr) {
                    console.error("[Dashboard] Querying Employee by SapUserName failed:", oErr);
                }
            }
        }

        const oMockUser = {
            registered: true,
            employeeId: "1001",
            employeeName: "Nguyen Van A",
            role: "Employee",
            is_manager: "",
            is_hr: "",
            is_admin: ""
        };
        oUiModel.setProperty("/currentUser", oMockUser);
        console.log("[DEBUG] Current user fallback (mock):", oMockUser);
        return oMockUser;
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