import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import LeaveRequestService, { LeaveRequestPayload, LeaveTypeEntry } from "../service/LeaveRequestService";

// ---------------------------------------------------------------------------
// Local model shape interfaces
// ---------------------------------------------------------------------------

interface LeaveRequest {
    LeaveType: string;
    StartDate: string | null;
    EndDate: string | null;
    TotalDays: number;
    HalfDay: boolean;
    Reason: string;
    AttachmentUrl: string;
}

interface Employee {
    EmployeeID: string;
    EmployeeName: string;
    DepartmentID: string;
    ManagerID: string;
}

interface Summary {
    LeaveType: string;
    Duration: string;
    RemainingBalance: string;
    Approver: string;
    Status: string;
}

interface CreateFormModel {
    leaveRequest: LeaveRequest;
    employee: Employee;
    summary: Summary;
    busy: boolean;
    leaveTypes: LeaveTypeEntry[];
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * @namespace zleave.zleave.controller
 *
 * CreateRequest controller
 * ========================
 * Handles the original Create Leave Request view UI and OData mappings.
 */
export default class CreateRequest extends Controller {

    private _oService: LeaveRequestService;

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    public onInit(): void {
        const oFormModel = new JSONModel({
            leaveRequest: {
                LeaveType: "",
                StartDate: null,
                EndDate: null,
                TotalDays: 0,
                HalfDay: false,
                Reason: "",
                AttachmentUrl: ""
            },
            employee: {
                EmployeeID: "MOCK001",
                EmployeeName: "Offline Employee Profile",
                DepartmentID: "Offline Dept",
                ManagerID: "MOCK_MGR"
            },
            summary: {
                LeaveType: "-",
                Duration: "0 Days",
                RemainingBalance: "12 Days",
                Approver: "MOCK_MGR",
                Status: "Pending"
            },
            busy: false,
            leaveTypes: []
        } satisfies CreateFormModel);

        this.getView().setModel(oFormModel, "createForm");

        const oRouter = (this.getOwnerComponent() as { getRouter(): InstanceType<typeof Router> }).getRouter();
        oRouter.getRoute("createRequest").attachPatternMatched(this._onPatternMatched, this);
    }

    // -----------------------------------------------------------------------
    // Route matched
    // -----------------------------------------------------------------------

    private _onPatternMatched(): void {
        this._resetForm();

        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "createRequest");
        }

        this._loadEmployeeInfo();
        void this._loadLeaveTypes();
    }

    // -----------------------------------------------------------------------
    // Employee Data Loading
    // -----------------------------------------------------------------------

    private async _getCurrentUserId(): Promise<string> {
        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        const sStoredId = oUiModel?.getProperty("/currentUser/id") as string | undefined;
        if (sStoredId) {
            return sStoredId;
        }

        try {
            const oResponse = await fetch("/sap/bc/ui2/start_up", {
                credentials: "same-origin"
            });
            if (oResponse.ok) {
                const oData = await oResponse.json() as Record<string, unknown>;
                const sId = (oData["id"] as string) ??
                            (oData["userId"] as string) ??
                            (oData["name"] as string) ??
                            "";
                if (oUiModel && sId) {
                    const sFullName = (oData["fullName"] as string) ??
                                      (oData["displayName"] as string) ??
                                      sId;
                    oUiModel.setProperty("/currentUser", {
                        id: sId,
                        displayName: sFullName
                    });
                }
                return sId;
            }
        } catch {
            // Keep the fallback
        }
        return "";
    }

    private async _loadEmployeeInfo(): Promise<void> {
        const oModel = this.getView().getModel();
        if (!oModel) {
            return;
        }

        const oFormModel = this._getFormModel();

        try {
            const sUserId = await this._getCurrentUserId();
            if (!sUserId) {
                MessageToast.show("Running with offline fallback employee profile");
                return;
            }

            (oModel as InstanceType<typeof ODataModel>).read("/Employee", {
                filters: [
                    new Filter("SapUserName", FilterOperator.EQ, sUserId)
                ],
                success: (oData: unknown): void => {
                    const oResult = oData as { results?: any[] };
                    if (oResult && oResult.results && oResult.results.length > 0) {
                        const oODataEmp = oResult.results[0];
                        const oEmp: Employee = {
                            EmployeeID: oODataEmp.EmployeeId,
                            EmployeeName: oODataEmp.FullName,
                            DepartmentID: oODataEmp.Department,
                            ManagerID: oODataEmp.ManagerSapUser
                        };
                        oFormModel.setProperty("/employee", oEmp);
                        oFormModel.setProperty("/summary/Approver", oEmp.ManagerID);
                    } else {
                        MessageToast.show("Running with offline fallback employee profile");
                    }
                },
                error: (): void => {
                    MessageToast.show("Running with offline fallback employee profile");
                }
            });
        } catch {
            MessageToast.show("Running with offline fallback employee profile");
        }
    }

    private async _loadLeaveTypes(): Promise<void> {
        const oService = this._getService();
        if (!oService) {
            return;
        }

        const oFormModel = this._getFormModel();
        try {
            const aTypes = await oService.readLeaveTypes();
            oFormModel.setProperty("/leaveTypes", aTypes);
        } catch (sErr) {
            MessageBox.error(
                typeof sErr === "string"
                    ? sErr
                    : "Failed to load leave types."
            );
        }
    }

    // -----------------------------------------------------------------------
    // Form handlers
    // -----------------------------------------------------------------------

    public onLeaveTypeChange(): void {
        const oFormModel = this._getFormModel();
        const sLeaveTypeKey = oFormModel.getProperty("/leaveRequest/LeaveType") as string;
        const aLeaveTypes = oFormModel.getProperty("/leaveTypes") as LeaveTypeEntry[] || [];
        const oSelectedType = aLeaveTypes.find(t => t.LeaveType === sLeaveTypeKey);

        let sTypeText = "-";
        if (oSelectedType) {
            sTypeText = oSelectedType.LeaveName;
        } else if (sLeaveTypeKey) {
            sTypeText = sLeaveTypeKey + " Leave";
        }
        oFormModel.setProperty("/summary/LeaveType", sTypeText);

        this.onDatesChange();
    }

    public onHalfDaySelect(): void {
        const oFormModel = this._getFormModel();
        const bHalfDay = oFormModel.getProperty("/leaveRequest/HalfDay") as boolean;

        if (bHalfDay) {
            const sStart = oFormModel.getProperty("/leaveRequest/StartDate") as string | null;
            if (sStart) {
                oFormModel.setProperty("/leaveRequest/EndDate", sStart);
            }
        }

        this.onDatesChange();
    }

    public onHalfDayPeriodSelect(): void {
        this.onDatesChange();
    }

    public onDatesChange(): void {
        const oFormModel = this._getFormModel();
        const sStart = oFormModel.getProperty("/leaveRequest/StartDate") as string | null;
        let sEnd = oFormModel.getProperty("/leaveRequest/EndDate") as string | null;
        const bHalfDay = oFormModel.getProperty("/leaveRequest/HalfDay") as boolean;

        if (!sStart) {
            oFormModel.setProperty("/leaveRequest/TotalDays", 0);
            oFormModel.setProperty("/summary/Duration", "0 Days");
            return;
        }

        if (bHalfDay) {
            sEnd = sStart;
            oFormModel.setProperty("/leaveRequest/EndDate", sStart);
        }

        if (!sEnd) {
            oFormModel.setProperty("/leaveRequest/TotalDays", 0);
            oFormModel.setProperty("/summary/Duration", "0 Days");
            return;
        }

        const dStart = new Date(sStart);
        const dEnd = new Date(sEnd);

        if (dEnd < dStart) {
            oFormModel.setProperty("/leaveRequest/TotalDays", 0);
            oFormModel.setProperty("/summary/Duration", "0 Days");
            return;
        }

        let nDays = 0;
        if (bHalfDay) {
            nDays = 0.5;
        } else {
            const nDiffTime = dEnd.getTime() - dStart.getTime();
            nDays = Math.ceil(nDiffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        oFormModel.setProperty("/leaveRequest/TotalDays", nDays);
        oFormModel.setProperty("/summary/Duration", nDays + " Day" + (nDays !== 1 ? "s" : ""));

        const sLeaveType = oFormModel.getProperty("/leaveRequest/LeaveType") as string;
        let nRemaining = 12;
        if (sLeaveType === "AL" || sLeaveType === "Annual") {
            nRemaining = Math.max(0, 12 - nDays);
        }
        oFormModel.setProperty("/summary/RemainingBalance", nRemaining + " Days");
    }

    // -----------------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------------

    private _validateForm(): boolean {
        const oFormModel = this._getFormModel();
        const oResourceBundle = (this.getOwnerComponent() as any)?.getModel("i18n")?.getResourceBundle();

        const sLeaveType = oFormModel.getProperty("/leaveRequest/LeaveType") as string;
        const sStart = oFormModel.getProperty("/leaveRequest/StartDate") as string | null;
        const sEnd = oFormModel.getProperty("/leaveRequest/EndDate") as string | null;
        const sReason = (oFormModel.getProperty("/leaveRequest/Reason") as string || "").trim();

        if (!sLeaveType) {
            MessageBox.error(oResourceBundle?.getText("errSelectLeaveType") || "Please select a Leave Type.");
            return false;
        }

        if (!sStart) {
            MessageBox.error(oResourceBundle?.getText("errSelectStartDate") || "Please select a Start Date.");
            return false;
        }

        if (!sEnd) {
            MessageBox.error(oResourceBundle?.getText("errSelectEndDate") || "Please select an End Date.");
            return false;
        }

        const dStart = new Date(sStart);
        const dEnd = new Date(sEnd);

        if (dEnd < dStart) {
            MessageBox.error(oResourceBundle?.getText("errDateComparison") || "End date cannot be earlier than start date.");
            return false;
        }

        if (sReason && sReason.length < 5) {
            MessageBox.error(oResourceBundle?.getText("errValidReason") || "Reason must be at least 5 characters.");
            return false;
        }

        return true;
    }

    // -----------------------------------------------------------------------
    // Submit / Save
    // -----------------------------------------------------------------------

    public onSaveDraft(): void {
        this._submitRequest("Draft");
    }

    public onSubmit(): void {
        this._submitRequest("Pending");
    }

    private _submitRequest(sStatus: string): void {
        if (!this._validateForm()) {
            return;
        }

        const oFormModel = this._getFormModel();
        const oEmployee = oFormModel.getProperty("/employee") as Employee;
        const oRequest = oFormModel.getProperty("/leaveRequest") as LeaveRequest;
        const oResourceBundle = (this.getOwnerComponent() as any)?.getModel("i18n")?.getResourceBundle();

        const oService = this._getService();
        if (!oService) {
            MessageBox.error("OData model is not available. Please refresh the page.");
            return;
        }

        const oPayload: LeaveRequestPayload = {
            LeaveType: oRequest.LeaveType,
            StartDate: new Date(oRequest.StartDate!),
            EndDate: new Date(oRequest.EndDate!),
            Reason: oRequest.Reason,
            AttachmentUrl: oRequest.AttachmentUrl
        };

        this.getView().setBusy(true);
        oFormModel.setProperty("/busy", true);

        void oService.createLeaveRequest(oPayload)
            .then((): void => {
                this.getView().setBusy(false);
                oFormModel.setProperty("/busy", false);

                const sMessage = sStatus === "Draft"
                    ? oResourceBundle?.getText("successDraft") || "Leave request draft saved successfully."
                    : oResourceBundle?.getText("successSubmit") || "Leave request submitted successfully.";
                MessageToast.show(sMessage);
                this._navToRequests();
            })
            .catch((sErr: unknown): void => {
                this.getView().setBusy(false);
                oFormModel.setProperty("/busy", false);

                MessageBox.error(
                    typeof sErr === "string"
                        ? sErr
                        : "An error occurred while submitting the leave request."
                );
            });
    }

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------

    public onCancel(): void {
        this._navToRequests();
    }

    public onNavBack(): void {
        this._navToRequests();
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private _getService(): LeaveRequestService | null {
        if (!this._oService) {
            const oRawModel = this.getView().getModel();
            if (!oRawModel) {
                return null;
            }
            this._oService = new LeaveRequestService(
                oRawModel as InstanceType<typeof ODataModel>
            );
        }
        return this._oService;
    }

    private _getFormModel(): InstanceType<typeof JSONModel> {
        return this.getView().getModel("createForm") as InstanceType<typeof JSONModel>;
    }

    private _resetForm(): void {
        const oFormModel = this._getFormModel();
        oFormModel.setProperty("/leaveRequest", {
            LeaveType: "",
            StartDate: null,
            EndDate: null,
            TotalDays: 0,
            HalfDay: false,
            Reason: "",
            AttachmentUrl: ""
        });
        oFormModel.setProperty("/summary", {
            LeaveType: "-",
            Duration: "0 Days",
            RemainingBalance: "12 Days",
            Approver: oFormModel.getProperty("/employee/ManagerID") || "",
            Status: "Pending"
        });
    }

    private _navToRequests(): void {
        const oRouter = (this.getOwnerComponent() as { getRouter(): InstanceType<typeof Router> }).getRouter();
        oRouter.navTo("requests", {}, true);
    }
}
