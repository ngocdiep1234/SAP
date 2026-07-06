import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";

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
            recentActivities: [
                {
                    text: "New employee 'Luong Ngoc Diep' added to the system.",
                    time: "10 mins ago",
                    icon: "sap-icon://add-employee",
                    state: "Success"
                },
                {
                    text: "Leave request REQ-2026-0042 approved by HR Manager.",
                    time: "1 hour ago",
                    icon: "sap-icon://accept",
                    state: "Success"
                },
                {
                    text: "System Quota assignment completed for year 2026.",
                    time: "Yesterday",
                    icon: "sap-icon://sys-enter-2",
                    state: "Information"
                }
            ]
        };

        const oMockModel = new JSONModel(oMockData);
        this.getView().setModel(oMockModel, "mock");
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
