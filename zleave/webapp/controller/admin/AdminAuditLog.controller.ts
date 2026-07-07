import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Table from "sap/m/Table";
import Spreadsheet from "sap/ui/export/Spreadsheet";

/**
 * @namespace zleave.zleave.controller.admin
 */
export default class AdminAuditLog extends Controller {

    public onInit(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("AdminAuditLog").attachPatternMatched(this._onPatternMatched, this);
    }

    private async _onPatternMatched(): Promise<void> {
        const oUiModel = (this as any).getOwnerComponent().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "audit");
        }

        const oTable = this.getView().byId("tableAuditLogs") as InstanceType<typeof Table> | undefined;
        if (oTable) {
            oTable.setBusy(true);
        }

        try {
            const oCurrentUser = await this._getCurrentUser();
            const bIsAdmin = oCurrentUser && (oCurrentUser.is_admin === "X" || oCurrentUser.is_admin === "true" || oCurrentUser.is_admin === "1");
            if (!bIsAdmin) {
                const oRouter = (this as any).getOwnerComponent().getRouter();
                oRouter.navTo("Unauthorized");
                return;
            }
            void this._applyFilters();
        } catch (oErr) {
            console.error("[AdminAuditLog] Authorization / Initialization failed:", oErr);
            MessageBox.error("Failed to verify user credentials. Loading aborted.");
        } finally {
            if (oTable) {
                oTable.setBusy(false);
            }
        }
    }

    private async _applyFilters(): Promise<void> {
        const oTable = this.getView().byId("tableAuditLogs") as InstanceType<typeof Table> | undefined;
        if (!oTable) {
            return;
        }
        const oBinding = oTable.getBinding("items");
        if (!oBinding) {
            return;
        }

        const aFilters: InstanceType<typeof Filter>[] = [];
        oBinding.filter(aFilters);
    }

    public onItemPress(oEvent: any): void {
        const oItem = oEvent.getSource();
        const oBindingContext = oItem.getBindingContext();
        if (!oBindingContext) {
            return;
        }
        const sLogId = String(oBindingContext.getProperty("LogId") || "");
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.navTo("AdminAuditLogDetail", {
            logId: sLogId
        });
    }

    public onExportExcel(): void {
        const oTable = this.getView().byId("tableAuditLogs") as any;
        const oRowBinding = oTable.getBinding("items");
        if (!oRowBinding) {
            MessageToast.show("No data to export.");
            return;
        }

        const aCols = [
            { label: "Action Time", property: "ActionAt", type: "dateTime" },
            { label: "Employee ID", property: "EmployeeId" },
            { label: "Request ID", property: "RequestId" },
            { label: "Action", property: "Action" },
            { label: "Performed By", property: "ActionBy" },
            { label: "Old Status", property: "OldStatus" },
            { label: "New Status", property: "NewStatus" },
            { label: "Comments", property: "Comments" }
        ];

        const oSettings = {
            workbook: { columns: aCols },
            dataSource: oRowBinding,
            fileName: "AuditLogs_Export.xlsx",
            worker: false
        };

        const oSheet = new Spreadsheet(oSettings);
        oSheet.build().finally(() => {
            oSheet.destroy();
        });
    }

    // Formatters
    public formatActionState(sAction: string, vCriticality: any): string {
        if (vCriticality !== null && vCriticality !== undefined && vCriticality !== "") {
            const nCriticality = Number(vCriticality);
            if (nCriticality === 1) return "Error";
            if (nCriticality === 2) return "Warning";
            if (nCriticality === 3) return "Success";
            if (nCriticality === 5) return "Information";
            return "None";
        }
        if (!sAction) {
            return "None";
        }
        const sActLower = sAction.toLowerCase();
        if (sActLower.includes("create") || sActLower.includes("activate") || sActLower.includes("approve")) {
            return "Success";
        }
        if (sActLower.includes("deactivate") || sActLower.includes("reject")) {
            return "Error";
        }
        if (sActLower.includes("update")) {
            return "Information";
        }
        if (sActLower.includes("cancel")) {
            return "Warning";
        }
        return "None";
    }

    public formatStatusState(sStatus: string): string {
        if (!sStatus) {
            return "None";
        }
        const sStatLower = sStatus.toLowerCase();
        if (sStatLower === "approved" || sStatLower === "mgr_approved") {
            return "Success";
        }
        if (sStatLower === "rejected") {
            return "Error";
        }
        if (sStatLower === "submitted" || sStatLower === "pending") {
            return "Warning";
        }
        return "None";
    }

    private async _getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string }> {
        const oUiModel = (this as any).getOwnerComponent().getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (!oUiModel) {
            return { registered: true, employeeId: "1001", employeeName: "Nguyen Van A", role: "Employee", is_manager: "", is_hr: "", is_admin: "" };
        }

        const oCachedUser = oUiModel.getProperty("/currentUser") as any;
        if (oCachedUser && oCachedUser.employeeId && oCachedUser.role) {
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
                console.error("[AuditLog] start_up check failed:", oErr);
            }
        }

        if (sSapUser) {
            const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
            if (oModel) {
                try {
                    const oResult = await new Promise<any>((resolve, reject) => {
                        oModel.read("/Employee", {
                            filters: [new Filter("SapUserName", FilterOperator.EQ, sSapUser)],
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
                        return oUserObj;
                    }
                } catch (oErr) {
                    console.error("[AuditLog] Employee query failed:", oErr);
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
        return oMockUser;
    }
}
