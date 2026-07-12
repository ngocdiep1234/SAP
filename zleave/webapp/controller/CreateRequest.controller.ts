import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import Router from "sap/ui/core/routing/Router";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import LeaveRequestService, { LeaveRequestPayload, LeaveTypeEntry, ManagerEntry } from "../service/LeaveRequestService";

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
    ApproverId: string;
    StartSession: string;
    EndSession: string;
}

interface Employee {
    EmployeeID: string;
    EmployeeName: string;
    DepartmentID: string;
    ManagerID: string;
    ManagerName?: string;
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
    managers: ManagerEntry[];
    /** true = user found in Employee master; false/undefined = blocked */
    employeeRegistered: boolean;
    quotas: any[];
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * @namespace zleave.zleave.controller
 *
 * CreateRequest controller
 * ========================
 * Handles the Create Leave Request view UI and OData mappings.
 *
 * On every route match the controller verifies that the currently logged-in
 * SAP user exists in the Employee master data before allowing any submission.
 * Unregistered users are blocked immediately with a MessageBox and the
 * Submit / Save Draft buttons are disabled.
 */
export default class CreateRequest extends Controller {

    private _oService: LeaveRequestService;
    private _selectedFile: File | null = null;

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
                ApproverId: "",
                StartSession: "",
                EndSession: ""
            },
            employee: {
                EmployeeID: "",
                EmployeeName: "",
                DepartmentID: "",
                ManagerID: "",
                ManagerName: ""
            },
            summary: {
                LeaveType: "-",
                Duration: "",
                RemainingBalance: "",
                Approver: "",
                Status: ""
            },
            busy: false,
            leaveTypes: [],
            managers: [],
            employeeRegistered: false,
            quotas: []
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

        // Block submission until employee check is done
        this._getFormModel().setProperty("/employeeRegistered", false);

        void this._checkAndLoadEmployee();
        void this._loadLeaveTypes();
        void this._loadManagers();
    }

    // -----------------------------------------------------------------------
    // Employee Registration Check  (core new feature)
    // -----------------------------------------------------------------------

    /**
     * Fetches the current SAP user's Employee record from the backend.
     *
     * Success (record found)  → populate employee fields, set employeeRegistered = true.
     * Failure (no record / OData error) → MessageBox.error, employeeRegistered stays false,
     *                                      Submit & SaveDraft buttons remain disabled.
     */
    private async _checkAndLoadEmployee(): Promise<void> {
        const oModel = this.getView().getModel();
        const oFormModel = this._getFormModel();

        if (!oModel) {
            console.error("[CreateRequest] OData model is not available.");
            MessageBox.error(
                "Could not connect to the system. Please reload the page.",
                { title: "Connection Error" }
            );
            return;
        }

        // Step 1: resolve current SAP user id
        let sUserId: string;
        try {
            sUserId = await this._getCurrentUserId();
        } catch (oErr) {
            console.error("[CreateRequest] Failed to resolve current user id:", oErr);
            this._blockWithError("Could not determine current user. Please reload the page.");
            return;
        }

        if (!sUserId) {
            console.warn("[CreateRequest] Current user id is empty.");
            this._blockWithError("Could not determine current user. Please reload the page.");
            return;
        }

        console.info(`[CreateRequest] Checking employee registration for user: ${sUserId}`);

        // Step 2: query Employee entity by SapUserName
        (oModel as InstanceType<typeof ODataModel>).read("/Employee", {
            filters: [
                new Filter("SapUserName", FilterOperator.EQ, sUserId)
            ],
            success: (oData: unknown): void => {
                const oResult = oData as { results?: Record<string, unknown>[] };

                if (oResult?.results && oResult.results.length > 0) {
                    // --------------------------------------------------------
                    // User IS registered → populate form & unlock buttons
                    // --------------------------------------------------------
                    const oODataEmp = oResult.results[0];
                    const oEmp: Employee = {
                        EmployeeID: String(oODataEmp["EmployeeId"] ?? ""),
                        EmployeeName: String(oODataEmp["FullName"] ?? ""),
                        DepartmentID: String(oODataEmp["Department"] ?? ""),
                        ManagerID: String(oODataEmp["ManagerSapUser"] ?? ""),
                        ManagerName: ""
                    };

                    oFormModel.setProperty("/employee", oEmp);
                    oFormModel.setProperty("/leaveRequest/ApproverId", oEmp.ManagerID);
                    this._updateSummaryApprover();
                    this._updateEmployeeManagerName();
                    oFormModel.setProperty("/employeeRegistered", true);
                    void this._loadEmployeeQuotas(oEmp.EmployeeID);

                    console.info(
                        `[CreateRequest] Employee found – ID: ${oEmp.EmployeeID}, Name: ${oEmp.EmployeeName}`
                    );
                } else {
                    // --------------------------------------------------------
                    // User NOT registered → block and show error
                    // --------------------------------------------------------
                    console.warn(
                        `[CreateRequest] No Employee record found for SapUserName="${sUserId}".`
                    );
                    this._blockWithError(
                        "You are not registered in the system. " +
                        "Please contact the administrator."
                    );
                }
            },
            error: (oError: unknown): void => {
                // --------------------------------------------------------
                // OData error → block and show error
                // --------------------------------------------------------
                const sDetail = this._extractODataErrorMessage(oError);
                console.error(
                    `[CreateRequest] OData error when reading /Employee (user="${sUserId}"):`,
                    sDetail,
                    oError
                );
                this._blockWithError(
                    "An error occurred while checking employee information. " +
                    "Please try again or contact the administrator.\n\n" +
                    `Details: ${sDetail}`
                );
            }
        });
    }

    /**
     * Displays a blocking MessageBox.error and keeps employeeRegistered = false
     * so that Submit / SaveDraft buttons stay disabled.
     */
    private _blockWithError(sMessage: string): void {
        this._getFormModel().setProperty("/employeeRegistered", false);
        MessageBox.error(sMessage, {
            title: "Could not create leave request"
        });
    }

    /**
     * Tries to extract a human-readable message from an OData V2 error response.
     */
    private _extractODataErrorMessage(oError: unknown): string {
        try {
            if (oError && typeof oError === "object") {
                const oErr = oError as { responseText?: string; message?: string };
                if (oErr.responseText) {
                    const oParsed = JSON.parse(oErr.responseText) as {
                        error?: { message?: { value?: string } }
                    };
                    return oParsed?.error?.message?.value ?? oErr.responseText;
                }
                if (oErr.message) {
                    return oErr.message;
                }
            }
        } catch {
            // ignore JSON parse errors
        }
        return "Unknown error";
    }

    // -----------------------------------------------------------------------
    // Current User Resolution
    // -----------------------------------------------------------------------

    private async _getCurrentUserId(): Promise<string> {
        const oComponent = (this as any).getOwnerComponent() as any;
        const oUser = await oComponent.getCurrentUser();
        return oUser ? oUser.id : "";
    }

    private async _loadLeaveTypes(): Promise<void> {
        const oService = this._getService();
        if (!oService) {
            return;
        }

        const oFormModel = this._getFormModel();
        try {
            const aTypes = await oService.readLeaveTypes();
            if (aTypes.length === 0) {
                MessageBox.warning("No leave types found on backend.");
            }
            oFormModel.setProperty("/leaveTypes", aTypes);
        } catch (sErr) {
            MessageBox.error(
                typeof sErr === "string"
                    ? sErr
                    : "Failed to load leave types."
            );
        }
    }

    private async _loadManagers(): Promise<void> {
        const oService = this._getService();
        if (!oService) {
            return;
        }

        const oFormModel = this._getFormModel();
        try {
            const aManagers = await oService.readManagers();
            if (aManagers.length === 0) {
                MessageBox.warning("No managers found on backend.");
            }
            oFormModel.setProperty("/managers", aManagers);
            this._updateSummaryApprover();
            this._updateEmployeeManagerName();
        } catch (sErr) {
            console.error("Failed to load managers:", sErr);
            MessageBox.error("Failed to load managers from backend.");
        }
    }

    private _loadEmployeeQuotas(sEmployeeId: string): Promise<void> {
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        const oFormModel = this._getFormModel();
        if (!oModel) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            oModel.read("/LeaveQuota", {
                filters: [
                    new Filter("EmployeeId", FilterOperator.EQ, sEmployeeId)
                ],
                success: (oData: any): void => {
                    const aQuotas = oData.results || [];
                    if (aQuotas.length === 0) {
                        MessageBox.warning("No leave balance data available for this employee.");
                    }
                    oFormModel.setProperty("/quotas", aQuotas);
                    // Trigger balance update in case dates/leave type were already selected
                    this.onDatesChange();
                    resolve();
                },
                error: (oErr: any): void => {
                    console.error("[CreateRequest] Failed to load leave quotas:", oErr);
                    MessageBox.error("Failed to load leave quota from backend.");
                    resolve();
                }
            });
        });
    }

    private _updateSummaryApprover(): void {
        const oFormModel = this._getFormModel();
        const sApproverId = oFormModel.getProperty("/leaveRequest/ApproverId") as string;
        const aManagers = oFormModel.getProperty("/managers") as ManagerEntry[] || [];
        const oSelectedManager = aManagers.find(m => m.ManagerUser === sApproverId);
        if (oSelectedManager) {
            oFormModel.setProperty("/summary/Approver", `${oSelectedManager.ManagerName} (${oSelectedManager.ManagerUser})`);
        } else {
            oFormModel.setProperty("/summary/Approver", sApproverId || "");
        }
    }

    private _updateEmployeeManagerName(): void {
        const oFormModel = this._getFormModel();
        const sManagerId = oFormModel.getProperty("/employee/ManagerID") as string;
        const aManagers = oFormModel.getProperty("/managers") as ManagerEntry[] || [];
        const oSelectedManager = aManagers.find(m => m.ManagerUser === sManagerId);
        if (oSelectedManager) {
            oFormModel.setProperty("/employee/ManagerName", oSelectedManager.ManagerName);
        } else {
            oFormModel.setProperty("/employee/ManagerName", sManagerId || "");
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

    public onApproverChange(): void {
        this._updateSummaryApprover();
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
        let sBalanceText = "";
        if (sLeaveType) {
            const aQuotas = oFormModel.getProperty("/quotas") as any[] || [];
            const oQuota = aQuotas.find(q => q.LeaveTypeId === sLeaveType);
            if (oQuota) {
                const nRemaining = Number(oQuota.RemainingDays ?? 0);
                const nFinal = Math.max(0, nRemaining - nDays);
                sBalanceText = nFinal + " Day" + (nFinal !== 1 ? "s" : "");
            } else {
                sBalanceText = "N/A";
            }
        }
        oFormModel.setProperty("/summary/RemainingBalance", sBalanceText);
    }

    // -----------------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------------

    private _validateForm(): boolean {
        const oFormModel = this._getFormModel();
        const oResourceBundle = (this.getOwnerComponent() as any)?.getModel("i18n")?.getResourceBundle();

        // Guard: employee must be registered
        const bRegistered = oFormModel.getProperty("/employeeRegistered") as boolean;
        if (!bRegistered) {
            MessageBox.error(
                "You are not registered in the system. " +
                "Please contact the administrator.",
                { title: "Could not create leave request" }
            );
            return false;
        }

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

    private async _submitRequest(sStatus: string): Promise<void> {
        if (!this._validateForm()) {
            return;
        }

        const oFormModel = this._getFormModel();
        const oRequest = oFormModel.getProperty("/leaveRequest") as LeaveRequest;

        const oService = this._getService();
        if (!oService) {
            MessageBox.error("OData model is not available. Please refresh the page.");
            return;
        }

        const mapSession = (sSessionVal?: string): string => {
            if (sSessionVal === "Morning") { return "M"; }
            if (sSessionVal === "Afternoon") { return "A"; }
            return "";
        };

        const oPayload: LeaveRequestPayload = {
            LeaveType: oRequest.LeaveType,
            StartDate: new Date(oRequest.StartDate!),
            EndDate: new Date(oRequest.EndDate!),
            Reason: oRequest.Reason,
            ApproverId: oRequest.ApproverId || (oFormModel.getProperty("/employee/ManagerID") as string) || "",
            StartSession: mapSession(oRequest.StartSession),
            EndSession: mapSession(oRequest.EndSession)
        };

        // Resolve file once before going async so we capture the latest state
        const oFile = this._getSelectedFile();
        console.info("[CreateRequest] File at submit:", oFile ? oFile.name : "none");

        // Lock UI – user sees only a spinner, no intermediate status text
        this.getView().setBusy(true);

        try {
            // ── Step 1: Create the leave request ──────────────────────────────
            const oCreatedData = await oService.createLeaveRequest(oPayload);
            const sUuid = (oCreatedData as { UUID: string }).UUID;
            console.info("[CreateRequest] Request created, UUID:", sUuid);

            // ── Step 2: Upload attachment (only if file was selected) ─────────
            if (oFile && sUuid) {
                try {
                    await oService.uploadAttachment(sUuid, oFile);
                    console.info("[CreateRequest] Attachment uploaded successfully.");
                } catch (oUploadErr) {
                    // Request created but upload failed → warn and navigate away
                    this.getView().setBusy(false);
                    MessageBox.warning(
                        "Leave request created, but the attachment upload failed: " +
                        (typeof oUploadErr === "string" ? oUploadErr : "Unknown error") +
                        ". You can retry uploading the attachment in the details page.",
                        { onClose: (): void => { this._navToRequests(); } }
                    );
                    try { this.getView().getModel()?.refresh(true); } catch { /* non-fatal */ }
                    return;
                }
            }

            // ── Step 3: Refresh model & show success ──────────────────────────
            try { this.getView().getModel()?.refresh(true); } catch { /* non-fatal */ }
            this.getView().setBusy(false);
            MessageBox.success("Leave Request created successfully.", {
                onClose: (): void => { this._navToRequests(); }
            });

        } catch (oCreateErr) {
            // Request creation failed
            this.getView().setBusy(false);
            MessageBox.error(
                typeof oCreateErr === "string"
                    ? oCreateErr
                    : "An error occurred while submitting the leave request."
            );
        }
    }

    /**
     * Returns the File object chosen by the user, or null if none.
     * The file is stored by onFileChange when the user selects a file via FileUploader.
     */
    private _getSelectedFile(): File | null {
        return this._selectedFile;
    }

    // -----------------------------------------------------------------------
    // FileUploader Handlers
    // -----------------------------------------------------------------------

    public onFileChange(oEvent: any): void {
        const aFiles = oEvent.getParameter("files") as FileList | null;
        if (aFiles && aFiles.length > 0) {
            const oFile = aFiles[0];
            const nSizeMb = oFile.size / (1024 * 1024);
            if (nSizeMb > 10) {
                MessageBox.error("File size must not exceed 10 MB.");
                this._selectedFile = null;
                const oUploader = this.byId("createFileUploader") as any;
                if (oUploader) { oUploader.clear(); }
                return;
            }
            this._selectedFile = oFile;
            console.info("[CreateRequest] File selected:", oFile.name);
        } else {
            this._selectedFile = null;
        }
    }

    public onFileSizeExceeds(): void {
        MessageBox.error("File size must not exceed 10 MB.");
        this._selectedFile = null;
    }

    public onTypeMismatch(): void {
        MessageBox.error("Only PDF, DOC, DOCX, XLSX, JPG, JPEG, PNG files are allowed.");
        this._selectedFile = null;
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
        this._selectedFile = null;
        const oFileUploader = this.byId("createFileUploader") as any;
        if (oFileUploader) {
            oFileUploader.clear();
        }
        oFormModel.setProperty("/leaveRequest", {
            LeaveType: "",
            StartDate: null,
            EndDate: null,
            TotalDays: 0,
            HalfDay: false,
            Reason: "",
            ApproverId: oFormModel.getProperty("/employee/ManagerID") || "",
            StartSession: "",
            EndSession: ""
        });
        oFormModel.setProperty("/summary", {
            LeaveType: "-",
            Duration: "",
            RemainingBalance: "",
            Approver: oFormModel.getProperty("/employee/ManagerID") || "",
            Status: ""
        });
        // Also clear employee data to avoid stale display before check completes
        oFormModel.setProperty("/employee", {
            EmployeeID: "",
            EmployeeName: "",
            DepartmentID: "",
            ManagerID: "",
            ManagerName: ""
        });
        oFormModel.setProperty("/quotas", []);
        this._updateSummaryApprover();
        this._updateEmployeeManagerName();
    }

    private _navToRequests(): void {
        const oRouter = (this.getOwnerComponent() as { getRouter(): InstanceType<typeof Router> }).getRouter();
        oRouter.navTo("requests", {}, true);
    }
}
