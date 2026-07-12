
import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Label from "sap/m/Label";
import Input from "sap/m/Input";
import DatePicker from "sap/m/DatePicker";
import TextArea from "sap/m/TextArea";
import VBox from "sap/m/VBox";
import MessageBox from "sap/m/MessageBox";
import Select from "sap/m/Select";
import SegmentedButton from "sap/m/SegmentedButton";
import Table from "sap/m/Table";
import ListItemBase from "sap/m/ListItemBase";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Event from "sap/ui/base/Event";
import JSONModel from "sap/ui/model/json/JSONModel";
import Sorter from "sap/ui/model/Sorter";

export default class Requests extends Controller {

    // Tracks which status the "pending" tab is filtering (SUBMITTED for Manager, MGR_APPROVED for HR)
    private _sPendingStatusFilter: string = "SUBMITTED";

    public onInit(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("requests").attachPatternMatched(this._onPatternMatched, this);
    }

    private async _onPatternMatched(): Promise<void> {
        console.log("[DEBUG] Requests page loaded. Initializing pattern match...");
        const oUiModel = this.getView().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "requests");
        }
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (oTable) {
            oTable.setBusy(true);
            oTable.setMode("MultiSelect");
        }
        this._loadEmployees();

        const oCurrentUser = await this._getCurrentUser();
        const bIsEmployeeOnly = !(oCurrentUser.is_manager || oCurrentUser.is_hr || oCurrentUser.is_admin);
        const sInitialTab = bIsEmployeeOnly ? "my" : "pending";

        if (oUiModel) {
            oUiModel.setProperty("/selectedRequestTab", sInitialTab);
            oUiModel.setProperty("/selectedMySubTab", "waiting");
            oUiModel.setProperty("/selectedPendingSubTab", "normal");
        }
        const oSegmentedButton =
            this.getView().byId("filterStatusButton") as InstanceType<typeof SegmentedButton> | undefined;
        if (oSegmentedButton) {
            oSegmentedButton.setSelectedKey(sInitialTab);
        }
        if (oTable) {
            if (sInitialTab === "my") {
                oTable.setMode("SingleSelectLeft");
            } else {
                oTable.setMode("MultiSelect");
            }
        }
        void this._applyFilters(sInitialTab).then(() => {
            this.updateToolbarVisibility(sInitialTab);
            if (oTable) {
                oTable.setBusy(false);
            }
        });
        this._autoDetectAdminView();
    }

    public onSelectionChange(): void {
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (!oTable) { return; }
        const aSelectedItems = oTable.getSelectedItems() || [];
        const oBtnApprove = this.getView().byId("btnApproveSelected") as InstanceType<typeof Button> | undefined;
        const oBtnReject = this.getView().byId("btnRejectSelected") as InstanceType<typeof Button> | undefined;
        const oBtnDelete = this.getView().byId("btnDeleteSelected") as InstanceType<typeof Button> | undefined;

        // Dùng _sPendingStatusFilter để check đúng status theo role (SUBMITTED cho Manager, MGR_APPROVED cho HR)
        const sExpectedStatus = this._sPendingStatusFilter.toUpperCase();
        const bEnabled = aSelectedItems.length > 0 && aSelectedItems.some((oItem: InstanceType<typeof ListItemBase>) => {
            const oContext = oItem.getBindingContext();
            if (!oContext) { return false; }
            const sStatus = String(oContext.getProperty("Status") || "").toUpperCase();
            return sStatus === sExpectedStatus;
        });

        if (oBtnApprove) { oBtnApprove.setEnabled(bEnabled); }
        if (oBtnReject) { oBtnReject.setEnabled(bEnabled); }
        if (oBtnDelete) {
            oBtnDelete.setEnabled(aSelectedItems.length === 1);
        }
    }

    private _loadEmployees(): void {
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (!oModel || !oUiModel) {
            return;
        }

        oModel.read("/Employee", {
            success: (oData: any): void => {
                const aEmployees = oData.results || [];
                const oMap: Record<string, string> = {};
                aEmployees.forEach((emp: any) => {
                    oMap[emp.EmployeeId] = emp.FullName || emp.SapUserName;
                });
                oUiModel.setProperty("/employeesMap", oMap);
            },
            error: (): void => {
                // Ignore or log
            }
        });
    }

    public formatEmployeeName(
        sEmployeeId: string,
        oMap: Record<string, string>
    ): string {

        if (!sEmployeeId || !oMap) {
            return "";
        }

        const sNormalizedId = sEmployeeId.padStart(8, "0");

        return oMap[sNormalizedId] || sEmployeeId;
    }

    public onItemPress(oEvent: InstanceType<typeof Event>): void {
        const oItem = oEvent.getSource() as InstanceType<typeof ListItemBase>;
        const oContext = oItem.getBindingContext();
        if (!oContext) {
            return;
        }

        const sUuid = String(oContext.getProperty("UUID") || "");
        const oRouter = (this.getOwnerComponent() as any).getRouter();
        oRouter.navTo("requestDetail", {
            uuid: sUuid
        });
    }

    public onFilterTabChange(oEvent: InstanceType<typeof Event>): void {
        const oSegmentedButton = oEvent.getSource() as InstanceType<typeof SegmentedButton>;
        const key = oSegmentedButton.getSelectedKey();
        const oUiModel = this.getView().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedRequestTab", key);
            if (key === "my" && !oUiModel.getProperty("/selectedMySubTab")) {
                oUiModel.setProperty("/selectedMySubTab", "waiting");
            }
        }
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (oTable) {
            if (key === "my") {
                oTable.setMode("SingleSelectLeft");
            } else {
                oTable.setMode("MultiSelect");
            }
        }
        switch (key) {
            case "pending":
                void this._applyFilters("pending");
                this.updateToolbarVisibility("pending");
                break;
            case "my":
                void this._applyFilters("my");
                this.updateToolbarVisibility("my");
                break;
            case "all":
                void this._applyFilters("all");
                this.updateToolbarVisibility("all");
                break;
            default:
                break;
        }
    }

    public onMySubFilterTabChange(oEvent: InstanceType<typeof Event>): void {
        const oSegmentedButton = oEvent.getSource() as InstanceType<typeof SegmentedButton>;
        const key = oSegmentedButton.getSelectedKey();
        const oUiModel = this.getView().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedMySubTab", key);
        }
        void this._applyFilters("my");
    }

    public onPendingSubFilterTabChange(oEvent: InstanceType<typeof Event>): void {
        const oSegmentedButton = oEvent.getSource() as InstanceType<typeof SegmentedButton>;
        const key = oSegmentedButton.getSelectedKey();
        const oUiModel = this.getView().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedPendingSubTab", key);
        }
        void this._applyFilters("pending");
    }

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string }> {
        const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
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
                console.error("[Requests] fetch /sap/bc/ui2/start_up failed:", oErr);
            }
        }

        if (sSapUser) {
            const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
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
                    console.error("[Requests] Querying Employee by SapUserName failed:", oErr);
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

    private async _applyFilters(sKey?: string, sSearchQuery?: string): Promise<void> {
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (!oTable) {
            return;
        }
        const oBinding = oTable.getBinding("items");
        if (!oBinding) {
            return;
        }
        const oBtn = this.getView().byId("filterStatusButton") as any;
        const sSelectedKey = sKey || (oBtn ? oBtn.getSelectedKey() : "pending");
        const oSearchField = this.getView().byId("filterEmployeeRequests") as any;
        const sQuery = sSearchQuery !== undefined ? sSearchQuery : (oSearchField ? oSearchField.getValue() : "");
        const aFilters: InstanceType<typeof Filter>[] = [];
        // 1. Tab-based Filters
        const oCurrentUser = await this._getCurrentUser();
        // LeaveRequest.EmployeeId lưu KHÔNG padding (vd "1002"), khác với Employee.EmployeeId
        // (vd "00001002"). Không pad ở đây, chỉ chuẩn hóa về dạng số nguyên dạng string.
        const sCurrentEmployeeId = String(parseInt(oCurrentUser.employeeId, 10));
        if (sSelectedKey === "pending") {
            // HR approves requests that managers already approved (MGR_APPROVED)
            // Managers approve newly submitted requests (SUBMITTED)
            // Support multiple truthy formats: ABAP "X", JS true, "true", "1"
            const vIsHr = oCurrentUser.is_hr;
            const bIsHr = vIsHr === "X" || vIsHr === "true" || vIsHr === "1";
            const sPendingStatus = bIsHr ? "MGR_APPROVED" : "SUBMITTED";
            this._sPendingStatusFilter = sPendingStatus;
            console.log("[DEBUG][Pending] Full currentUser:", JSON.stringify(oCurrentUser));
            console.log("[DEBUG][Pending] is_hr raw:", JSON.stringify(vIsHr), "| bIsHr:", bIsHr, "| Status filter:", sPendingStatus);
            aFilters.push(new Filter("Status", FilterOperator.EQ, sPendingStatus));
            if (sCurrentEmployeeId) {
                aFilters.push(new Filter("EmployeeId", FilterOperator.NE, sCurrentEmployeeId));
            }

            const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
            const sSubTab = oUiModel?.getProperty("/selectedPendingSubTab") as string || "normal";
            const fnTestAbnormal = (oValue: any, oContext: any) => {
                const oData = oContext ? oContext.getObject() : oValue;
                if (!oData) return false;
                const bAbnormal = this._checkAbnormality(oData.StartDate, oData.CreatedAt, oData.TotalDays).isAbnormal;
                return sSubTab === "warning" ? bAbnormal : !bAbnormal;
            };
            aFilters.push(new Filter({
                path: "",
                test: fnTestAbnormal
            } as any));
        } else if (sSelectedKey === "my") {
            if (sCurrentEmployeeId) {
                aFilters.push(new Filter("EmployeeId", FilterOperator.EQ, sCurrentEmployeeId));
            } else {
                aFilters.push(new Filter("EmployeeId", FilterOperator.EQ, ""));
            }

            const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
            const sSubTab = oUiModel?.getProperty("/selectedMySubTab") as string || "waiting";
            if (sSubTab === "completed") {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Status", FilterOperator.EQ, "Approved"),
                        new Filter("Status", FilterOperator.EQ, "APPROVED"),
                        new Filter("Status", FilterOperator.EQ, "Rejected"),
                        new Filter("Status", FilterOperator.EQ, "REJECTED")
                    ],
                    and: false
                }));
            } else {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Status", FilterOperator.NE, "Approved"),
                        new Filter("Status", FilterOperator.NE, "APPROVED"),
                        new Filter("Status", FilterOperator.NE, "Rejected"),
                        new Filter("Status", FilterOperator.NE, "REJECTED")
                    ],
                    and: true
                }));
            }
        }
        // 2. Search-based Filters
        if (sQuery) {
            const aOrFilters: InstanceType<typeof Filter>[] = [
                new Filter("RequestId", FilterOperator.Contains, sQuery),
                new Filter("LeaveType", FilterOperator.Contains, sQuery)
            ];
            const oUiModel = this.getView().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
            const oMap = oUiModel?.getProperty("/employeesMap") as Record<string, string> | undefined;
            if (oMap) {
                const sQueryLower = sQuery.toLowerCase();
                Object.entries(oMap).forEach(([sId, sName]) => {
                    if (sName && sName.toLowerCase().includes(sQueryLower)) {
                        // Chỉ filter theo dạng không padding, khớp với LeaveRequest.EmployeeId
                        aOrFilters.push(new Filter("EmployeeId", FilterOperator.EQ, String(parseInt(sId, 10))));
                    }
                });
            }
            aFilters.push(new Filter({ filters: aOrFilters, and: false }));
        }
        // Clear selection to avoid actions on hidden/invalid items
        oTable.removeSelections();
        this.onSelectionChange();
        console.log("[DEBUG][_applyFilters] CurrentEmployeeId:", sCurrentEmployeeId, "| SelectedKey:", sSelectedKey);
        console.log("[DEBUG][_applyFilters] Applied filters:", aFilters.map((f: any) => f.sPath + " " + f.sOperator + " " + f.oValue1));
        oBinding.filter(aFilters);

        // Apply sorters dynamically on client
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        if (sSelectedKey === "pending") {
            const oSorter = new Sorter("UUID", false, false, (uuidA: string, uuidB: string) => {
                if (!oModel) return 0;
                const sEntityPath = oBinding.getPath();
                const oDataA = oModel.getProperty(`${sEntityPath}(guid'${uuidA}')`) as any;
                const oDataB = oModel.getProperty(`${sEntityPath}(guid'${uuidB}')`) as any;

                const oAbnormalA = this._checkAbnormality(oDataA?.StartDate, oDataA?.CreatedAt, oDataA?.TotalDays).isAbnormal;
                const oAbnormalB = this._checkAbnormality(oDataB?.StartDate, oDataB?.CreatedAt, oDataB?.TotalDays).isAbnormal;

                if (oAbnormalA && !oAbnormalB) {
                    return -1;
                }
                if (!oAbnormalA && oAbnormalB) {
                    return 1;
                }

                const dCreatedA = oDataA?.CreatedAt ? new Date(oDataA.CreatedAt).getTime() : 0;
                const dCreatedB = oDataB?.CreatedAt ? new Date(oDataB.CreatedAt).getTime() : 0;
                return dCreatedB - dCreatedA;
            });
            oBinding.sort([oSorter]);
        } else {
            const oSorter = new Sorter("CreatedAt", true);
            oBinding.sort([oSorter]);
        }
    }

    private updateToolbarVisibility(sKey: string): void {
        const oBtnApprove = this.getView().byId("btnApproveSelected") as InstanceType<typeof Button> | undefined;
        const oBtnReject = this.getView().byId("btnRejectSelected") as InstanceType<typeof Button> | undefined;
        const oBtnDelete = this.getView().byId("btnDeleteSelected") as InstanceType<typeof Button> | undefined;
        const bIsSubmitted = sKey === "pending" || sKey === "SUBMITTED" || sKey === "MGR_APPROVED";
        const bIsMy = sKey === "my";
        if (oBtnApprove) {
            oBtnApprove.setVisible(bIsSubmitted);
        }
        if (oBtnReject) {
            oBtnReject.setVisible(bIsSubmitted);
        }
        if (oBtnDelete) {
            oBtnDelete.setVisible(sKey === "my");
        }
    }

    public onDeleteSelected(): void {
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (!oTable) { return; }
        const aSelectedItems = oTable.getSelectedItems();
        if (!aSelectedItems || aSelectedItems.length === 0) { return; }

        MessageBox.confirm(
            "Are you sure you want to delete the selected leave request(s)?",
            {
                title: "Delete Leave Requests",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: (sAction?: string) => {
                    if (sAction === MessageBox.Action.YES) {
                        void this._executeDelete(aSelectedItems);
                    }
                }
            }
        );
    }

    private async _executeDelete(aItems: InstanceType<typeof ListItemBase>[]): Promise<void> {
        const oView = this.getView();
        oView.setBusy(true);

        const aPromises = aItems.map((oItem) => {
            const oContext = oItem.getBindingContext();
            if (!oContext) {
                return Promise.resolve({ success: false, uuid: "", error: "No binding context found" });
            }
            const sUuid = oContext.getProperty("UUID") as string;
            return this._deleteRequest(sUuid);
        });

        const aResults = await Promise.all(aPromises);
        oView.setBusy(false);

        const aSuccesses = aResults.filter(r => r.success);
        const aFailures = aResults.filter(r => !r.success);

        // Refresh the model
        const oModel = oView.getModel() as InstanceType<typeof ODataModel> | undefined;
        if (oModel) {
            oModel.refresh(true);
        }

        // Reset table selection & disable buttons
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (oTable) {
            oTable.removeSelections();
        }
        this.onSelectionChange();

        if (aFailures.length === 0) {
            MessageToast.show("Leave request(s) deleted successfully");
        } else {
            const sDetails = aFailures.map(f => f.error).join("\n");
            MessageBox.error(sDetails, {
                title: "Error Deleting Requests"
            });
        }
    }

    private _deleteRequest(sUuid: string): Promise<{ success: boolean; uuid: string; error?: string }> {
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel> | undefined;
        return new Promise((resolve) => {
            if (!oModel) {
                resolve({ success: false, uuid: sUuid, error: "OData Model is not available" });
                return;
            }
            oModel.remove(`/LeaveRequest(guid'${sUuid}')`, {
                success: () => {
                    resolve({ success: true, uuid: sUuid });
                },
                error: (oError: { responseText?: string; message?: string }) => {
                    let sMsg = "Unknown error";
                    try {
                        if (oError && oError.responseText) {
                            const oParsed = JSON.parse(oError.responseText) as {
                                error?: {
                                    message?: {
                                        value?: string;
                                    };
                                };
                            };
                            sMsg = (oParsed.error && oParsed.error.message && oParsed.error.message.value) || sMsg;
                        } else if (oError && oError.message) {
                            sMsg = oError.message;
                        }
                    } catch (e) {
                        sMsg = (oError && oError.message) || sMsg;
                    }
                    resolve({ success: false, uuid: sUuid, error: sMsg });
                }
            });
        });
    }

    private _getActionName(sActionType: "approve" | "reject", bIsHr: boolean): string {
        const oModel = (this as any).getView().getModel() as any;
        if (oModel && typeof oModel.getServiceMetadata === "function") {
            const oMetadata = oModel.getServiceMetadata();
            if (oMetadata && oMetadata.dataServices && oMetadata.dataServices.schema) {
                const aSchemas = oMetadata.dataServices.schema;
                for (const oSchema of aSchemas) {
                    if (oSchema.entityContainer) {
                        const aContainers = Array.isArray(oSchema.entityContainer) ? oSchema.entityContainer : [oSchema.entityContainer];
                        for (const oContainer of aContainers) {
                            if (oContainer.functionImport) {
                                const aFuncs = Array.isArray(oContainer.functionImport) ? oContainer.functionImport : [oContainer.functionImport];
                                const sTargetName = bIsHr
                                    ? (sActionType === "approve" ? "hrApproveResult" : "hrRejectResult")
                                    : (sActionType === "approve" ? "approveResult" : "rejectResult");
                                const sAltName = bIsHr
                                    ? (sActionType === "approve" ? "hrApproveLeave" : "hrRejectLeave")
                                    : (sActionType === "approve" ? "approveLeave" : "rejectLeave");
                                if (aFuncs.some((f: any) => f.name === sTargetName)) {
                                    return sTargetName;
                                }
                                if (aFuncs.some((f: any) => f.name === sAltName)) {
                                    return sAltName;
                                }
                            }
                        }
                    }
                }
            }
        }
        return bIsHr
            ? (sActionType === "approve" ? "hrApproveResult" : "hrRejectResult")
            : (sActionType === "approve" ? "approveLeave" : "rejectLeave");
    }

    private _callAction(sActionName: string, sUuid: string): Promise<{ success: boolean; uuid: string; error?: string }> {
        const oModel = (this as any).getView().getModel() as any;
        return new Promise((resolve) => {
            oModel.callFunction("/" + sActionName, {
                method: "POST",
                urlParameters: {
                    UUID: sUuid
                },
                success: () => {
                    resolve({ success: true, uuid: sUuid });
                },
                error: (oError: any) => {
                    let sMsg = "Unknown error";
                    try {
                        if (oError && oError.responseText) {
                            const oParsed = JSON.parse(oError.responseText);
                            sMsg = (oParsed.error && oParsed.error.message && oParsed.error.message.value) || sMsg;
                        } else if (oError && oError.message) {
                            sMsg = oError.message;
                        }
                    } catch (e) {
                        sMsg = (oError && oError.message) || sMsg;
                    }
                    resolve({ success: false, uuid: sUuid, error: sMsg });
                }
            });
        });
    }

    public onApproveSelected(): void {
        void this._processMultipleRequests("approve");
    }

    public onRejectSelected(): void {
        void this._processMultipleRequests("reject");
    }

    private async _processMultipleRequests(sActionType: "approve" | "reject"): Promise<void> {
        const oTable = (this as any).byId("tableRequests") as any;
        if (!oTable) { return; }
        const aSelectedItems = oTable.getSelectedItems() || [];
        if (aSelectedItems.length === 0) { return; }

        const oResourceBundle = ((this as any).getView().getModel("i18n") as any).getResourceBundle();
        const oCurrentUser = await this._getCurrentUser();
        const vIsHr = oCurrentUser.is_hr;
        const bIsHr = vIsHr === "X" || vIsHr === "true" || vIsHr === "1";

        const sActionName = this._getActionName(sActionType, bIsHr);

        // Filter valid requests using the dynamic rule
        const aEligibleItems = aSelectedItems.filter((oItem: any) => {
            const oContext = oItem.getBindingContext();
            if (!oContext) { return false; }

            // Check dynamic action controls first (backend-driven _ac flags)
            // Fallback: match current pending status filter (SUBMITTED for MGR, MGR_APPROVED for HR)
            const bApproveAc = bIsHr
                ? (oContext.getProperty("hrApproveResult_ac") ?? oContext.getProperty("hrApproveLeave_ac"))
                : (oContext.getProperty("approveLeave_ac") ?? oContext.getProperty("approveResult_ac"));
            const bRejectAc = bIsHr
                ? (oContext.getProperty("hrRejectResult_ac") ?? oContext.getProperty("hrRejectLeave_ac"))
                : (oContext.getProperty("rejectLeave_ac") ?? oContext.getProperty("rejectResult_ac"));
            const sStatus = String(oContext.getProperty("Status") || "").toUpperCase();
            // Use _sPendingStatusFilter: "SUBMITTED" for Manager, "MGR_APPROVED" for HR
            const bStatusEligible = sStatus === this._sPendingStatusFilter.toUpperCase()
                || sStatus === "SUBMITTED"
                || sStatus === "PENDING"
                || sStatus === "MGR_APPROVED";

            if (sActionType === "approve") {
                return bApproveAc !== undefined ? bApproveAc === true : bStatusEligible;
            } else {
                return bRejectAc !== undefined ? bRejectAc === true : bStatusEligible;
            }
        });

        if (aEligibleItems.length === 0) {
            MessageToast.show("No selected requests are eligible for this action.");
            return;
        }

        const sTitleKey = sActionType === "approve" ? "confirmApproveTitle" : "confirmRejectTitle";
        const sConfirmKey = sActionType === "approve" ? "confirmApproveMultiple" : "confirmRejectMultiple";
        const sConfirmText = oResourceBundle.getText(sConfirmKey, [aEligibleItems.length]);

        const oDlg = new Dialog({
            title: oResourceBundle.getText(sTitleKey),
            type: "Message",
            content: new Label({ text: sConfirmText }),
            beginButton: new Button({
                text: oResourceBundle.getText("yes"),
                press: () => {
                    oDlg.close();
                    void this._executeActionOnItems(sActionType, sActionName, aEligibleItems);
                }
            }),
            endButton: new Button({
                text: oResourceBundle.getText("no"),
                press: () => {
                    oDlg.close();
                }
            }),
            afterClose: () => {
                oDlg.destroy();
            }
        });
        oDlg.open();
    }

    private async _executeActionOnItems(sActionType: "approve" | "reject", sActionName: string, aItems: any[]): Promise<void> {
        const oView = (this as any).getView();
        oView.setBusy(true);

        const aPromises = aItems.map((oItem: any) => {
            const oContext = oItem.getBindingContext();
            const sUuid = oContext.getProperty("UUID");
            const sRequestId = oContext.getProperty("RequestId") || "Unknown";
            return this._callAction(sActionName, sUuid).then((oRes) => {
                return { ...oRes, requestId: sRequestId };
            });
        });

        const aResults = await Promise.all(aPromises);
        oView.setBusy(false);

        const aSuccesses = aResults.filter(r => r.success);
        const aFailures = aResults.filter(r => !r.success);

        // Refresh the model
        const oModel = oView.getModel();
        if (oModel) {
            oModel.refresh(true);
        }

        // Reset table selection & disable buttons
        const oTable = (this as any).byId("tableRequests") as any;
        if (oTable) {
            oTable.removeSelections();
        }
        this.onSelectionChange();

        const oResourceBundle = (oView.getModel("i18n") as any).getResourceBundle();

        if (aFailures.length === 0) {
            const sSuccessKey = sActionType === "approve" ? "successApproveMultiple" : "successRejectMultiple";
            const sSuccessMsg = oResourceBundle.getText(sSuccessKey, [aSuccesses.length]);
            MessageToast.show(sSuccessMsg);
        } else {
            // Some or all failed. Format failure details
            const sSuccessKey = sActionType === "approve" ? "successApproveMultiple" : "successRejectMultiple";
            const sSuccessMsg = oResourceBundle.getText(sSuccessKey, [aSuccesses.length]);
            const sErrorSummaryText = oResourceBundle.getText("errorSummaryText");
            const sErrorSummaryTitle = oResourceBundle.getText("errorSummaryTitle");

            const sDetails = aFailures.map(f => `Request ID ${f.requestId}: ${f.error}`).join("\n");
            const sMessage = `${sSuccessMsg}\n\n${sErrorSummaryText}\n${sDetails}`;

            MessageBox.error(sMessage, {
                title: sErrorSummaryTitle
            });
        }
    }

    public onNavToCreate(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("createRequest");
    }

    public onSearch(oEvent: any): void {
        const sQuery: string = (oEvent.getParameter && (oEvent.getParameter("query") || oEvent.getParameter("newValue"))) || "";
        void this._applyFilters(undefined, sQuery);
    }

    public onFilter(oEvent: any): void {
        const sValue = (oEvent.getParameter && (oEvent.getParameter("query") || oEvent.getParameter("newValue"))) || "";
        void this._applyFilters(undefined, sValue);
    }
    public onRefresh(): void {
        const oModel = (this as any).getView().getModel();
        if (oModel && oModel.refresh) {
            oModel.refresh(true);
            MessageToast.show((this as any).getView().getModel("i18n").getProperty("refreshed"));
        }
    }

    private _updateStatus(sPath: string, sStatus: string): void {
        const oModel = (this as any).getView().getModel();
        const oPayload = { Status: sStatus } as any;
        oModel.update(sPath, oPayload, {
            success: () => {
                MessageToast.show((this as any).getView().getModel("i18n").getProperty("updateSuccess"));
                // refresh app-level stats
                try { (this as any).getView().getModel().refresh(true); } catch { }
            },
            error: () => { MessageToast.show((this as any).getView().getModel("i18n").getProperty("updateError")); }
        });
    }

    public onApprove(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sPath = oContext.getPath();
        const oDlg = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("confirmApproveTitle"),
            type: "Message",
            content: [],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("yes"),
                press: () => {
                    this._updateStatus(sPath, "Approved");
                    oDlg.close();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("no"), press: () => oDlg.close() })
        });
        oDlg.open();
    }

    public onReject(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sPath: string = String(oContext.getPath());
        const oDlg = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("confirmRejectTitle"),
            type: "Message",
            content: [],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("yes"),
                press: () => {
                    this._updateStatus(sPath, "Rejected");
                    oDlg.close();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("no"), press: () => oDlg.close() })
        });
        oDlg.open();
    }

    public onOpenAttachment(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sAttachment = oContext.getProperty("AttachmentURL") as string;

        if (sAttachment) {
            window.open(sAttachment, "_blank");
        } else {
            MessageToast.show(
                (this as any).getView().getModel("i18n").getProperty("noAttachment")
            );
        }
    }

    public onCreate(): void {
        const sViewId = (this as any).getView().getId();
        const oEmpId = new Input(sViewId + "-empId");
        const oEmpName = new Input(sViewId + "-empName");
        const oLeaveType = new Input(sViewId + "-leaveType");
        const oStart = new DatePicker(sViewId + "-start");
        const oEnd = new DatePicker(sViewId + "-end");
        const oReason = new TextArea(sViewId + "-reason");

        const oVBox = new VBox({
            items: [
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("employeeId") }), oEmpId,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("employeeName") }), oEmpName,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("leaveType") }), oLeaveType,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("startDate") }), oStart,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("endDate") }), oEnd,
                new Label({ text: (this as any).getView().getModel("i18n").getProperty("reason") }), oReason
            ]
        });

        const oDialog = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("createTitle"),
            content: [oVBox],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("save"),
                press: () => {
                    const oEntry: any = {
                        EmployeeId: oEmpId.getValue(),
                        EmployeeName: oEmpName.getValue(),
                        LeaveType: oLeaveType.getValue(),
                        StartDate: oStart.getDateValue() ? ((oStart.getDateValue() as Date).toISOString()) : null,
                        EndDate: oEnd.getDateValue() ? ((oEnd.getDateValue() as Date).toISOString()) : null,
                        Reason: oReason.getValue(),
                        Status: "Pending"
                    };
                    const oModel = (this as any).getView().getModel();
                    oModel.create("/LeaveRequest", oEntry, {
                        success: () => {
                            MessageToast.show((this as any).getView().getModel("i18n").getProperty("createSuccess"));
                            try { (this as any).getView().getModel().refresh(true); } catch { }
                        },
                        error: () => { MessageToast.show((this as any).getView().getModel("i18n").getProperty("createError")); }
                    });
                    oDialog.close();
                    oDialog.destroy();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("cancel"), press: () => { oDialog.close(); oDialog.destroy(); } }),
            afterClose: () => { oDialog.destroy(); }
        });
        oDialog.open();
    }

    private _autoDetectAdminView(): void {
        const oTable = this.getView().byId("tableRequests") as InstanceType<typeof Table> | undefined;
        if (!oTable) { return; }

        this._getCurrentUser()
            .then((oCurrentUser) => {
                console.log("[DEBUG] [AdminViewCheck] Current user:", oCurrentUser);

                // Dùng LeaveRequestAdmin nếu là Admin hoặc HR, ngược lại dùng LeaveRequest
                const bIsAdminOrHr = oCurrentUser.is_admin === "X" || oCurrentUser.is_hr === "X";
                const sPath = bIsAdminOrHr ? "/LeaveRequestAdmin" : "/LeaveRequest";
                console.log("[DEBUG] [AdminViewCheck] is_admin:", oCurrentUser.is_admin, "| is_hr:", oCurrentUser.is_hr, "-> Binding table to:", sPath);

                const oBindingInfo = oTable.getBindingInfo("items") as any;
                if (oBindingInfo && oBindingInfo.path !== sPath) {
                    oBindingInfo.path = sPath;
                    if (!oBindingInfo.parameters) {
                        oBindingInfo.parameters = {};
                    }
                    oBindingInfo.parameters.operationMode = "Client";
                    oTable.bindItems(oBindingInfo);

                    const oSegmentedButton = this.getView().byId("filterStatusButton") as InstanceType<typeof SegmentedButton> | undefined;
                    const sKey = oSegmentedButton ? oSegmentedButton.getSelectedKey() : "pending";
                    void this._applyFilters(sKey);
                }
            })
            .catch((oErr: unknown) => {
                console.error("[DEBUG] [AdminViewCheck] Failed to get current user:", oErr);
                // Fallback: giữ nguyên binding mặc định từ XML view
            });
    }

    private _checkAbnormality(oStartDate: any, oCreatedAt: any, vTotalDays: any): { isAbnormal: boolean; reasons: string[] } {
        const aReasons: string[] = [];

        if (!oStartDate || !oCreatedAt) {
            return { isAbnormal: false, reasons: [] };
        }

        const dStart = new Date(oStartDate);
        const dCreated = new Date(oCreatedAt);

        // Zero out times for date-only comparison
        const dStartZero = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate());
        const dCreatedZero = new Date(dCreated.getFullYear(), dCreated.getMonth(), dCreated.getDate());

        const nDiffTime = dStartZero.getTime() - dCreatedZero.getTime();
        const nDiffDays = Math.ceil(nDiffTime / (1000 * 60 * 60 * 24)); // Days difference

        const nTotalDays = Number(vTotalDays || 0);


        if (nTotalDays > 2) {
            aReasons.push("Nghỉ quá 2 ngày");
        }
        if (nDiffDays < 3) {
            aReasons.push("Nộp < 3 ngày so với ngày nghỉ");
        }
        return {
            isAbnormal: aReasons.length > 0,
            reasons: aReasons
        };
    }

    public formatRowHighlight(oStartDate: any, oCreatedAt: any, vTotalDays: any, sSelectedTab: string): string {
        if (sSelectedTab !== "pending") {
            return "None";
        }
        const oResult = this._checkAbnormality(oStartDate, oCreatedAt, vTotalDays);
        return oResult.isAbnormal ? "Error" : "None";
    }

    public formatAbnormalReason(oStartDate: any, oCreatedAt: any, vTotalDays: any): string {
        const oResult = this._checkAbnormality(oStartDate, oCreatedAt, vTotalDays);
        return oResult.reasons.join(", ");
    }

    public formatAbnormalVisible(oStartDate: any, oCreatedAt: any, vTotalDays: any, sSelectedTab: string): boolean {
        if (sSelectedTab !== "pending") {
            return false;
        }
        const oResult = this._checkAbnormality(oStartDate, oCreatedAt, vTotalDays);
        return oResult.isAbnormal;
    }
}

