import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import MessageToast from "sap/m/MessageToast";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";

/**
 * @namespace zleave.zleave.controller.admin
 */
export default class AdminQuotaManagement extends Controller {
    public onInit(): void {
        // Initialization for Admin Quota Management
    }

    public formatEmployeeName(sFullName: string, sEmployeeId: string): string {
        if (sFullName) {
            return `${sFullName} (${sEmployeeId})`;
        }
        return sEmployeeId || "";
    }

    public formatCriticalityState(iCriticality: number): string {
        switch (iCriticality) {
            case 1:
                return "Error";
            case 2:
                return "Warning";
            case 3:
                return "Success";
            default:
                return "None";
        }
    }

    public formatDateRange(oDateFrom: any, oDateTo: any): string {
        if (!oDateFrom || !oDateTo) {
            return "";
        }
        const fFormat = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const r = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${r}`;
        };
        return `${fFormat(new Date(oDateFrom))} - ${fFormat(new Date(oDateTo))}`;
    }

    public onSearch(oEvent: any): void {
        const sQuery = oEvent.getParameter("query");
        const oTable = this.getView().byId("tableQuota") as any;
        const oBinding = oTable.getBinding("items");

        const aFilters = [];
        if (sQuery && sQuery.trim().length > 0) {
            aFilters.push(new Filter({
                filters: [
                    new Filter("EmployeeId", FilterOperator.Contains, sQuery),
                    new Filter("EmployeeName", FilterOperator.Contains, sQuery),
                    new Filter("SapUserName", FilterOperator.Contains, sQuery),
                    new Filter("LeaveTypeName", FilterOperator.Contains, sQuery),
                    new Filter("LeaveTypeId", FilterOperator.Contains, sQuery),
                    new Filter("QuotaYear", FilterOperator.Contains, sQuery)
                ],
                and: false
            }));
        }
        oBinding.filter(aFilters);
    }

    public onRefresh(): void {
        const oModel = this.getView().getModel() as InstanceType<typeof ODataModel>;
        if (oModel) {
            oModel.refresh(true);
            MessageToast.show("Refreshed");
        }
    }
}
