import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Fragment from "sap/ui/core/Fragment";
import DateFormat from "sap/ui/core/format/DateFormat";
import MessageToast from "sap/m/MessageToast";
import Event from "sap/ui/base/Event";
import LeaveRequestService from "../service/LeaveRequestService";

interface CalendarAppointmentData {
    startDate: Date;
    endDate: Date;
    title: string;
    text: string;
    type: string;
    icon: string;
    LeaveTypeDisplay: string;
    StartDateRaw: Date | string | null;
    EndDateRaw: Date | string | null;
    TotalDays: string;
    Reason: string;
}

/**
 * @namespace zleave.zleave.controller
 */
export default class MyLeaveCalendar extends Controller {

    private _oLeaveRequestService: LeaveRequestService;
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

    public onInit(): void {
        const oCalendarModel = new JSONModel({
            startDate: new Date(),
            title: "My Approved Leaves",
            appointments: []
        });
        this.getView().setModel(oCalendarModel, "calendar");

        const oRouter = (this as any).getOwnerComponent().getRouter();
        if (oRouter) {
            oRouter.getRoute("myLeaveCalendar").attachPatternMatched(this._onPatternMatched, this);
        }
    }

    private async _onPatternMatched(): Promise<void> {
        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "myLeaveCalendar");
        }
        await this._loadCalendarData();
    }

    private async _loadCalendarData(): Promise<void> {
        const oView = this.getView();
        oView.setBusy(true);

        try {
            const oCurrentUser = await this._getCurrentUser();
            const sRawEmpId = oCurrentUser.employeeId || "";
            const sCurrentEmployeeId = sRawEmpId ? String(parseInt(sRawEmpId, 10)) : "";

            const oLeaveRequestService = this._getLeaveRequestService();
            if (!oLeaveRequestService) {
                oView.setBusy(false);
                return;
            }

            // Fetch leave types for friendly descriptions
            let mLeaveTypeMap: Record<string, string> = {};
            try {
                const aLeaveTypes = await oLeaveRequestService.readLeaveTypes();
                aLeaveTypes.forEach((lt) => {
                    mLeaveTypeMap[lt.LeaveType] = lt.LeaveName ? `${lt.LeaveName} (${lt.LeaveType})` : lt.LeaveType;
                });
            } catch (oErr) {
                console.warn("[MyLeaveCalendar] Failed to load leave types map:", oErr);
            }

            const aApprovedRequests = await oLeaveRequestService.readApprovedLeaveRequests(sCurrentEmployeeId);

            const aAppointments: CalendarAppointmentData[] = aApprovedRequests.map((req: any) => {
                let dStart = req.StartDate ? new Date(req.StartDate) : new Date();
                let dEnd = req.EndDate ? new Date(req.EndDate) : new Date();

                // Set start and end hours for proper full-day month visualization
                dStart = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate(), 0, 0, 0);
                dEnd = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate(), 23, 59, 59);

                const sLeaveTypeDisplay = mLeaveTypeMap[req.LeaveType] || req.LeaveType || "Leave";
                const nDays = req.TotalDays !== undefined && req.TotalDays !== null ? parseFloat(req.TotalDays) : 0;
                const sTotalDaysText = `${nDays} day(s)`;

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
                    title: sLeaveTypeDisplay,
                    text: sTotalDaysText,
                    type: sType,
                    icon: "sap-icon://flight",
                    LeaveTypeDisplay: sLeaveTypeDisplay,
                    StartDateRaw: req.StartDate,
                    EndDateRaw: req.EndDate,
                    TotalDays: nDays.toFixed(1),
                    Reason: req.Reason || "No reason provided"
                };
            });

            const oCalendarModel = oView.getModel("calendar") as InstanceType<typeof JSONModel>;
            const sTitle = oCurrentUser.employeeName ? `Leave Calendar - ${oCurrentUser.employeeName}` : "My Approved Leaves";

            oCalendarModel.setProperty("/title", sTitle);
            oCalendarModel.setProperty("/appointments", aAppointments);

        } catch (oErr) {
            console.error("[MyLeaveCalendar] Failed to load calendar data:", oErr);
            MessageToast.show("Failed to load approved leave requests.");
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

        const oData: CalendarAppointmentData = oContext.getObject();
        const oDateFormat = DateFormat.getDateInstance({ style: "medium" });

        const sStartDateFormatted = oData.StartDateRaw ? oDateFormat.format(new Date(oData.StartDateRaw)) : "";
        const sEndDateFormatted = oData.EndDateRaw ? oDateFormat.format(new Date(oData.EndDateRaw)) : "";

        const oDetailsModel = new JSONModel({
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
        void this._loadCalendarData().then(() => {
            const oI18n = (this.getView().getModel("i18n") as any)?.getResourceBundle();
            MessageToast.show(oI18n ? oI18n.getText("refreshed") : "Refreshed");
        });
    }

    private _openDetailsDialog(): void {
        if (!this._oDialog) {
            Fragment.load({
                id: this.getView().getId(),
                name: "zleave.zleave.view.MyLeaveCalendarDetailsDialog",
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

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string }> {
        const oComponent = (this as any).getOwnerComponent() as any;
        return oComponent.getCurrentUser();
    }
}
