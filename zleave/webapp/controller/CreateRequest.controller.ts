import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";

interface Employee {
    EmployeeID: string;
    EmployeeName: string;
    DepartmentID: string;
    ManagerID: string;
}

interface LeaveRequest {
    LeaveType: string;
    StartDate: string | null;
    EndDate: string | null;
    TotalDays: number;
    HalfDay: boolean;
    HalfDayPeriod: string;
    Reason: string;
}

interface Summary {
    LeaveType: string;
    Duration: string;
    RemainingBalance: string;
    Approver: string;
    Status: string;
}

export default class CreateRequest extends Controller {

    public onInit(): void {
        const oFormModel = new JSONModel({
            employee: {
                EmployeeID: "EMP0001",
                EmployeeName: "Nguyễn Văn A",
                DepartmentID: "IT Support",
                ManagerID: "MGR0002"
            },
            leaveRequest: {
                LeaveType: "",
                StartDate: null,
                EndDate: null,
                TotalDays: 0,
                HalfDay: false,
                HalfDayPeriod: "Morning",
                Reason: ""
            },
            summary: {
                LeaveType: "-",
                Duration: "0 Days",
                RemainingBalance: "12 Days",
                Approver: "MGR0002",
                Status: "Draft"
            }
        });

        this.getView().setModel(oFormModel, "createForm");

        // Load employee data from OData model when it becomes available
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("createRequest").attachPatternMatched(this._onPatternMatched, this);
    }

    private _onPatternMatched(): void {
        this._resetForm();
        this._loadEmployeeInfo();
        
        // Synchronize sidebar selection
        const oUiModel = this.getView().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "createRequest");
        }
    }

    private _resetForm(): void {
        const oFormModel = this.getView().getModel("createForm") as any;
        oFormModel.setProperty("/leaveRequest", {
            LeaveType: "",
            StartDate: null,
            EndDate: null,
            TotalDays: 0,
            HalfDay: false,
            HalfDayPeriod: "Morning",
            Reason: ""
        });
        oFormModel.setProperty("/summary", {
            LeaveType: "-",
            Duration: "0 Days",
            RemainingBalance: "12 Days",
            Approver: oFormModel.getProperty("/employee/ManagerID") || "-",
            Status: "Draft"
        });

        const oUploadSet = this.byId("uploadSet") as any;
        if (oUploadSet) {
            oUploadSet.removeAllItems();
        }
    }

    private _loadEmployeeInfo(): void {
        const oModel = this.getView().getModel();
        const oFormModel = this.getView().getModel("createForm") as any;

        if (!oModel) {
            return;
        }

        oModel.read("/ZI_EMPLOYEE", {
            success: (oData: any): void => {
                if (oData && oData.results && oData.results.length > 0) {
                    // Pick the first employee as the mock logged-in employee
                    const oEmp: Employee = oData.results[0];
                    oFormModel.setProperty("/employee", oEmp);
                    oFormModel.setProperty("/summary/Approver", oEmp.ManagerID);
                }
            },
            error: (): void => {
                // Keep the default fallback initialized in onInit
                MessageToast.show("Running with offline fallback employee profile");
            }
        });
    }

    public onLeaveTypeChange(): void {
        const oFormModel = this.getView().getModel("createForm") as any;
        const sLeaveType = oFormModel.getProperty("/leaveRequest/LeaveType");

        // Update summary leave type text
        let sTypeText = "-";
        if (sLeaveType) {
            sTypeText = sLeaveType + " Leave";
        }
        oFormModel.setProperty("/summary/LeaveType", sTypeText);

        this.onDatesChange();
    }

    public onHalfDaySelect(): void {
        const oFormModel = this.getView().getModel("createForm") as any;
        const bHalfDay = oFormModel.getProperty("/leaveRequest/HalfDay");

        if (bHalfDay) {
            // Half day must start and end on the same day
            const sStart = oFormModel.getProperty("/leaveRequest/StartDate");
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
        const oFormModel = this.getView().getModel("createForm") as any;
        const sStart = oFormModel.getProperty("/leaveRequest/StartDate");
        let sEnd = oFormModel.getProperty("/leaveRequest/EndDate");
        const bHalfDay = oFormModel.getProperty("/leaveRequest/HalfDay");

        if (!sStart) {
            oFormModel.setProperty("/leaveRequest/TotalDays", 0);
            oFormModel.setProperty("/summary/Duration", "0 Days");
            return;
        }

        if (bHalfDay) {
            // For half day, end date is always equal to start date
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

        // Deduct from remaining balance if type is Annual Leave (mock logic)
        const sLeaveType = oFormModel.getProperty("/leaveRequest/LeaveType");
        let nRemaining = 12;
        if (sLeaveType === "Annual") {
            nRemaining = Math.max(0, 12 - nDays);
        }
        oFormModel.setProperty("/summary/RemainingBalance", nRemaining + " Days");
    }

    private _validateForm(): boolean {
        const oFormModel = this.getView().getModel("createForm") as any;
        const oResourceBundle = (this as any).getOwnerComponent().getModel("i18n").getResourceBundle();

        const sLeaveType = oFormModel.getProperty("/leaveRequest/LeaveType");
        const sStart = oFormModel.getProperty("/leaveRequest/StartDate");
        const sEnd = oFormModel.getProperty("/leaveRequest/EndDate");
        const sReason = oFormModel.getProperty("/leaveRequest/Reason") || "";

        if (!sLeaveType) {
            MessageBox.error(oResourceBundle.getText("errSelectLeaveType"));
            return false;
        }

        if (!sStart) {
            MessageBox.error(oResourceBundle.getText("errSelectStartDate"));
            return false;
        }

        if (!sEnd) {
            MessageBox.error(oResourceBundle.getText("errSelectEndDate"));
            return false;
        }

        const dStart = new Date(sStart);
        const dEnd = new Date(sEnd);

        if (dEnd < dStart) {
            MessageBox.error(oResourceBundle.getText("errDateComparison"));
            return false;
        }

        if (sReason && sReason.trim().length < 5) {
            MessageBox.error(oResourceBundle.getText("errValidReason"));
            return false;
        }

        return true;
    }

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

        const oFormModel = this.getView().getModel("createForm") as any;
        const oEmployee: Employee = oFormModel.getProperty("/employee");
        const oRequest: LeaveRequest = oFormModel.getProperty("/leaveRequest");
        const oResourceBundle = (this as any).getOwnerComponent().getModel("i18n").getResourceBundle();

        const oModel = this.getView().getModel();
        if (!oModel) {
            MessageToast.show("OData Model is not initialized");
            return;
        }

        // Prepare attachments filename (if any)
        let sAttachmentURL = "";
        const oUploadSet = this.byId("uploadSet") as any;
        if (oUploadSet) {
            const aItems = oUploadSet.getItems() || [];
            if (aItems.length > 0) {
                sAttachmentURL = "https://demo-server/uploads/" + encodeURIComponent(aItems[0].getFileName());
            }
        }

        const oPayload = {
            EmployeeID: oEmployee.EmployeeID,
            EmployeeName: oEmployee.EmployeeName,
            DepartmentID: oEmployee.DepartmentID,
            ManagerID: oEmployee.ManagerID,
            LeaveType: oRequest.LeaveType,
            StartDate: new Date(oRequest.StartDate!),
            EndDate: new Date(oRequest.EndDate!),
            TotalDays: oRequest.TotalDays.toString(), // Entity expects Decimal/String depending on precision
            Reason: oRequest.Reason,
            Status: sStatus,
            AttachmentURL: sAttachmentURL
        };

        this.getView().setBusy(true);

        oModel.create("/LeaveRequest", oPayload, {
            success: (): void => {
                this.getView().setBusy(false);
                const sMessage = sStatus === "Draft"
                    ? oResourceBundle.getText("successDraft")
                    : oResourceBundle.getText("successSubmit");
                MessageToast.show(sMessage);

                // Refresh list model to show the new item
                try {
                    oModel.refresh(true);
                } catch {
                    // Ignore
                }

                this.onNavBack();
            },
            error: (oErr: any): void => {
                this.getView().setBusy(false);
                let sDetails = "An error occurred while saving the leave request.";
                try {
                    if (oErr && oErr.responseText) {
                        const oParsed = JSON.parse(oErr.responseText);
                        if (oParsed && oParsed.error && oParsed.error.message) {
                            sDetails = oParsed.error.message.value;
                        }
                    }
                } catch {
                    // Ignore
                }
                MessageBox.error(sDetails);
            }
        });
    }

    public onCancel(): void {
        this.onNavBack();
    }

    public onNavBack(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("requests", {}, true);
    }
}
