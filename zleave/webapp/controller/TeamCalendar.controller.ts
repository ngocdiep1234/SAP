import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Fragment from "sap/ui/core/Fragment";
import DateFormat from "sap/ui/core/format/DateFormat";
import MessageToast from "sap/m/MessageToast";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import Event from "sap/ui/base/Event";
import LeaveRequestService from "../service/LeaveRequestService";
import EmployeeService from "../service/EmployeeService";

interface TeamAppointmentData {
    startDate: Date;
    endDate: Date;
    title: string;
    text: string;
    type: string;
    icon: string;
    EmployeeName: string;
    LeaveTypeDisplay: string;
    StartDateRaw: Date | string | null;
    EndDateRaw: Date | string | null;
    TotalDays: string;
    Reason: string;
}

/**
 * @namespace zleave.zleave.controller
 */
export default class TeamCalendar extends Controller {

    private _oLeaveRequestService: LeaveRequestService;
    private _oEmployeeService: EmployeeService;
    private _oDialog: any = null;

    private _getLeaveRequestService(): LeaveRequestService | null {
        if (!this._oLeaveRequestService) {
            const oRawModel = (this as any).getOwnerComponent().getModel();
            if (!oRawModel) {
                return null;
            }
            this._oLeaveRequestService = new LeaveRequestService(
                oRawModel as InstanceType<typeof ODataModel>
            );
        }
        return this._oLeaveRequestService;
    }

    private _getEmployeeService(): EmployeeService | null {
        if (!this._oEmployeeService) {
            const oRawModel = (this as any).getOwnerComponent().getModel();
            if (!oRawModel) {
                return null;
            }
            this._oEmployeeService = new EmployeeService(
                oRawModel as InstanceType<typeof ODataModel>
            );
        }
        return this._oEmployeeService;
    }

    public onInit(): void {
        const oCalendarModel = new JSONModel({
            startDate: new Date(),
            title: "Team Leave Calendar",
            appointments: []
        });
        this.getView().setModel(oCalendarModel, "calendar");

        const oRouter = (this as any).getOwnerComponent().getRouter();
        if (oRouter) {
            oRouter.getRoute("teamCalendar").attachPatternMatched(this._onPatternMatched, this);
        }
    }

    private async _onPatternMatched(): Promise<void> {
        const oCurrentUser: any = await this._getCurrentUser();
        const bIsAuthorized = oCurrentUser && (
            oCurrentUser.is_manager === "X" || oCurrentUser.is_manager === "true" || oCurrentUser.is_manager === "1" ||
            oCurrentUser.is_admin === "X" || oCurrentUser.is_admin === "true" || oCurrentUser.is_admin === "1" ||
            oCurrentUser.is_hr === "X" || oCurrentUser.is_hr === "true" || oCurrentUser.is_hr === "1"
        );

        if (!bIsAuthorized) {
            const oRouter = (this.getOwnerComponent() as any).getRouter();
            if (oRouter) {
                oRouter.navTo("dashboard", {}, true);
            }
            return;
        }

        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "teamCalendar");
        }
        await this._loadTeamCalendarData();
    }

    private async _loadTeamCalendarData(): Promise<void> {
        const oView = this.getView();
        oView.setBusy(true);

        try {
            const oCurrentUser: any = await this._getCurrentUser();
            const sSapUser = (oCurrentUser.id || oCurrentUser.displayName || "").trim();
            const sCurrentEmployeeId = oCurrentUser.employeeId ? String(parseInt(oCurrentUser.employeeId, 10)) : "";

            const oEmployeeService = this._getEmployeeService();
            const oLeaveRequestService = this._getLeaveRequestService();

            if (!oEmployeeService || !oLeaveRequestService) {
                oView.setBusy(false);
                return;
            }

            // Fetch all employees to build team map
            const aEmployees = await oEmployeeService.readEmployees();

            // Filter team members where ManagerSapUser matches logged-in user
            const mTeamMap: Record<string, string> = {};
            const aTeamEmpIds: string[] = [];

            aEmployees.forEach((emp) => {
                const sManagerUser = (emp.ManagerSapUser || "").trim();
                const bIsDirectReport = sManagerUser && (
                    sManagerUser.toUpperCase() === sSapUser.toUpperCase() ||
                    (sCurrentEmployeeId && String(parseInt(emp.EmployeeId, 10)) !== sCurrentEmployeeId && emp.ManagerSapUser === oCurrentUser.id)
                );

                // Include direct reports or if user is HR/Admin and team size is empty
                if (bIsDirectReport) {
                    const sNormId = String(parseInt(emp.EmployeeId, 10));
                    mTeamMap[sNormId] = emp.FullName || emp.SapUserName;
                    aTeamEmpIds.push(sNormId);
                }
            });

            // Fallback: If no direct reports found by ManagerSapUser, but user is Manager/HR/Admin, match by Department or all team
            if (aTeamEmpIds.length === 0) {
                aEmployees.forEach((emp) => {
                    const sNormId = String(parseInt(emp.EmployeeId, 10));
                    // Exclude manager themselves
                    if (sNormId !== sCurrentEmployeeId) {
                        mTeamMap[sNormId] = emp.FullName || emp.SapUserName;
                        aTeamEmpIds.push(sNormId);
                    }
                });
            }

            // Fetch leave types for friendly descriptions
            let mLeaveTypeMap: Record<string, string> = {};
            try {
                const aLeaveTypes = await oLeaveRequestService.readLeaveTypes();
                aLeaveTypes.forEach((lt) => {
                    mLeaveTypeMap[lt.LeaveType] = lt.LeaveName ? `${lt.LeaveName} (${lt.LeaveType})` : lt.LeaveType;
                });
            } catch (oErr) {
                console.warn("[TeamCalendar] Failed to load leave types map:", oErr);
            }

            // Fetch approved leave requests
            const oRawModel = oView.getModel() as InstanceType<typeof ODataModel>;
            const aFilters = [
                new Filter({
                    filters: [
                        new Filter("Status", FilterOperator.EQ, "APPROVED"),
                        new Filter("Status", FilterOperator.EQ, "Approved")
                    ],
                    and: false
                })
            ];

            const aApprovedRequests = await new Promise<any[]>((resolve, reject) => {
                oRawModel.read("/LeaveRequest", {
                    filters: aFilters,
                    success: (oData: { results: any[] }): void => {
                        resolve(oData.results ?? []);
                    },
                    error: (oErr: any): void => {
                        reject(oErr);
                    }
                });
            });

            // Filter requests strictly for team members
            const aTeamApprovedRequests = aApprovedRequests.filter((req: any) => {
                const sNormEmpId = String(parseInt(req.EmployeeId, 10));
                return mTeamMap.hasOwnProperty(sNormEmpId);
            });

            const aAppointments: TeamAppointmentData[] = aTeamApprovedRequests.map((req: any) => {
                let dStart = req.StartDate ? new Date(req.StartDate) : new Date();
                let dEnd = req.EndDate ? new Date(req.EndDate) : new Date();

                // Set start and end hours for proper full-day month visualization
                dStart = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate(), 0, 0, 0);
                dEnd = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate(), 23, 59, 59);

                const sNormEmpId = String(parseInt(req.EmployeeId, 10));
                const sEmployeeName = mTeamMap[sNormEmpId] || `Employee #${req.EmployeeId}`;
                const sLeaveTypeDisplay = mLeaveTypeMap[req.LeaveType] || req.LeaveType || "Leave";
                const nDays = req.TotalDays !== undefined && req.TotalDays !== null ? parseFloat(req.TotalDays) : 0;

                let sType = "Type08";
                const sLtUpper = (req.LeaveType || "").toUpperCase();
                if (sLtUpper === "AL" || sLtUpper.includes("ANNUAL")) {
                    sType = "Type01";
                } else if (sLtUpper === "SL" || sLtUpper.includes("SICK")) {
                    sType = "Type05";
                } else if (sLtUpper === "UL" || sLtUpper.includes("UNPAID")) {
                    sType = "Type03";
                }

                return {
                    startDate: dStart,
                    endDate: dEnd,
                    title: sEmployeeName,
                    text: sLeaveTypeDisplay,
                    type: sType,
                    icon: "sap-icon://employee",
                    EmployeeName: sEmployeeName,
                    LeaveTypeDisplay: sLeaveTypeDisplay,
                    StartDateRaw: req.StartDate,
                    EndDateRaw: req.EndDate,
                    TotalDays: nDays.toFixed(1),
                    Reason: req.Reason || "No reason provided"
                };
            });

            const oCalendarModel = oView.getModel("calendar") as InstanceType<typeof JSONModel>;
            const sTitle = oCurrentUser.employeeName ? `Team Leave Calendar - ${oCurrentUser.employeeName}'s Team` : "Team Leave Calendar";

            oCalendarModel.setProperty("/title", sTitle);
            oCalendarModel.setProperty("/appointments", aAppointments);

        } catch (oErr) {
            console.error("[TeamCalendar] Failed to load team calendar data:", oErr);
            MessageToast.show("Failed to load team leave requests.");
        } finally {
            oView.setBusy(false);
        }
    }

    public onAppointmentSelect(oEvent: InstanceType<typeof Event>): void {
        const oAppointment = oEvent.getParameter("appointment") as any;
        if (!oAppointment) {
            return;
        }

        const oContext = oAppointment.getBindingContext("calendar");
        if (!oContext) {
            return;
        }

        const oData: TeamAppointmentData = oContext.getObject();
        const oDateFormat = DateFormat.getDateInstance({ style: "medium" });

        const sStartDateFormatted = oData.StartDateRaw ? oDateFormat.format(new Date(oData.StartDateRaw)) : "";
        const sEndDateFormatted = oData.EndDateRaw ? oDateFormat.format(new Date(oData.EndDateRaw)) : "";

        const oDetailsModel = new JSONModel({
            EmployeeName: oData.EmployeeName,
            LeaveTypeDisplay: oData.LeaveTypeDisplay,
            StartDateFormatted: sStartDateFormatted,
            EndDateFormatted: sEndDateFormatted,
            TotalDays: oData.TotalDays,
            Reason: oData.Reason
        });

        this.getView().setModel(oDetailsModel, "details");
        this._openDetailsDialog();
    }

    public onCloseDetailsDialog(): void {
        if (this._oDialog) {
            this._oDialog.close();
        }
    }

    public onRefresh(): void {
        void this._loadTeamCalendarData().then(() => {
            const oI18n = (this.getView().getModel("i18n") as any)?.getResourceBundle();
            MessageToast.show(oI18n ? oI18n.getText("refreshed") : "Refreshed");
        });
    }

    private _openDetailsDialog(): void {
        if (!this._oDialog) {
            Fragment.load({
                id: this.getView().getId(),
                name: "zleave.zleave.view.TeamCalendarDetailsDialog",
                controller: this
            }).then((oDialog: any) => {
                this._oDialog = oDialog;
                this.getView().addDependent(this._oDialog);
                this._oDialog.open();
            });
        } else {
            this._oDialog.open();
        }
    }

    private async _getCurrentUser(): Promise<any> {
        const oComponent = (this as any).getOwnerComponent() as any;
        return oComponent.getCurrentUser();
    }
}
