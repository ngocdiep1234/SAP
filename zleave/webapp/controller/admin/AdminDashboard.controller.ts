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
        const oMockData = {
            metrics: {
                totalEmployees: 48,
                activeEmployees: 45,
                pendingRequests: 7,
                approvedThisMonth: 12,
                criticalReminders: 3
            },
            pendingApprovals: [
                {
                    RequestId: "REQ-2026-0045",
                    EmployeeName: "Nguyen Van A",
                    LeaveType: "AL",
                    StartDate: new Date("2026-07-01"),
                    EndDate: new Date("2026-07-03"),
                    TotalDays: 3,
                    Status: "SUBMITTED"
                },
                {
                    RequestId: "REQ-2026-0046",
                    EmployeeName: "Tran Thi B",
                    LeaveType: "SL",
                    StartDate: new Date("2026-07-05"),
                    EndDate: new Date("2026-07-05"),
                    TotalDays: 1,
                    Status: "SUBMITTED"
                },
                {
                    RequestId: "REQ-2026-0047",
                    EmployeeName: "Luong Ngoc Diep",
                    LeaveType: "UL",
                    StartDate: new Date("2026-07-10"),
                    EndDate: new Date("2026-07-14"),
                    TotalDays: 5,
                    Status: "MGR_APPROVED"
                }
            ],
            whoIsOutToday: [
                {
                    EmployeeName: "Le Van C",
                    LeaveType: "Annual Leave",
                    Period: "Jun 25 - Jun 30",
                    Status: "Out of Office"
                },
                {
                    EmployeeName: "Pham Thi D",
                    LeaveType: "Sick Leave",
                    Period: "Jun 28 (Afternoon)",
                    Status: "Out of Office"
                }
            ],
            recentActivities: []
        };

        const oMockModel = new JSONModel(oMockData);
        this.getView().setModel(oMockModel, "mock");

        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("AdminDashboard").attachPatternMatched(this._onPatternMatched, this);
    }

    private _onPatternMatched(): void {
        void this._getCurrentUser();
        this._loadRecentActivities();
    }

    private _loadRecentActivities(): void {
        const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
        if (!oModel) {
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

                const oMockModel = this.getView().getModel("mock") as InstanceType<typeof JSONModel>;
                if (oMockModel) {
                    oMockModel.setProperty("/recentActivities", aActivities);
                }
            },
            error: (oErr: any) => {
                console.error("Failed to load audit logs for dashboard", oErr);
            }
        });
    }

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string; accessRolesText?: string }> {
        const oUiModel = (this as any).getOwnerComponent().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (!oUiModel) {
            return { registered: true, employeeId: "1001", employeeName: "Nguyen Van A", role: "Employee", is_manager: "", is_hr: "", is_admin: "" };
        }

        const oCachedUser = oUiModel.getProperty("/currentUser") as any;
        if (oCachedUser && oCachedUser.employeeId && oCachedUser.role) {
            if (!oCachedUser.accessRolesText) {
                oCachedUser.accessRolesText = [
                    (oCachedUser.is_admin === "X" || oCachedUser.is_admin === "true" || oCachedUser.is_admin === "1") ? "Admin" : "",
                    (oCachedUser.is_hr === "X" || oCachedUser.is_hr === "true" || oCachedUser.is_hr === "1") ? "HR" : "",
                    (oCachedUser.is_manager === "X" || oCachedUser.is_manager === "true" || oCachedUser.is_manager === "1") ? "Manager" : ""
                ].filter(Boolean).join(", ") || "Employee";
                oUiModel.setProperty("/currentUser", oCachedUser);
            }
            return oCachedUser;
        }

        let sSapUser = oCachedUser?.id as string | undefined;

        if (!sSapUser) {
            try {
                const oResponse = await fetch("/sap/bc/ui2/start_up", {
                    credentials: "same-origin"
                });
                if (oResponse.ok) {
                    const oData = await oResponse.json() as Record<string, unknown>;
                    sSapUser = (oData["id"] as string) ?? (oData["userId"] as string) ?? (oData["name"] as string) ?? "";
                }
            } catch (oErr) {
                console.error("[AdminDashboard] fetch /sap/bc/ui2/start_up failed:", oErr);
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
                        const sAccessRolesText = [
                            (oEmp["IsAdmin"] === "X" || oEmp["IsAdmin"] === "true" || oEmp["IsAdmin"] === "1") ? "Admin" : "",
                            (oEmp["IsHR"] === "X" || oEmp["IsHR"] === "true" || oEmp["IsHR"] === "1") ? "HR" : "",
                            (oEmp["IsManager"] === "X" || oEmp["IsManager"] === "true" || oEmp["IsManager"] === "1") ? "Manager" : ""
                        ].filter(Boolean).join(", ") || "Employee";
                        const oUserObj = {
                            registered: true,
                            employeeId: String(oEmp["EmployeeId"] ?? ""),
                            employeeName: String(oEmp["FullName"] ?? oEmp["SapUserName"] ?? ""),
                            id: sSapUser,
                            displayName: String(oEmp["FullName"] ?? oEmp["SapUserName"] ?? ""),
                            role: String(oEmp["PositionTitle"] ?? "Employee"),
                            is_manager: String(oEmp["IsManager"] ?? ""),
                            is_hr: String(oEmp["IsHR"] ?? ""),
                            is_admin: String(oEmp["IsAdmin"] ?? ""),
                            accessRolesText: sAccessRolesText
                        };
                        oUiModel.setProperty("/currentUser", oUserObj);
                        return oUserObj;
                    }
                } catch (oErr) {
                    console.error("[AdminDashboard] Querying Employee failed:", oErr);
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
            is_admin: "",
            accessRolesText: "Employee"
        };
        oUiModel.setProperty("/currentUser", oMockUser);
        return oMockUser;
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
