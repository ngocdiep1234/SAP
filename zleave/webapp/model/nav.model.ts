import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * Creates the navigation model for the Admin Shell.
 * This model manages the selected key, the collapsed state of the sidebar,
 * and the list of menu items.
 */
export function createNavModel(): InstanceType<typeof JSONModel> {
    const oData = {
        selectedKey: "dash",
        collapsed: false,
        items: [
            {
                id: "dash",
                text: "Dashboard",
                icon: "sap-icon://home",
                route: "AdminDashboard"
            },
            {
                id: "emp",
                text: "Employees",
                icon: "sap-icon://employee",
                route: "AdminEmployees"
            },
            {
                id: "leave",
                text: "Leave Requests",
                icon: "sap-icon://request",
                route: "AdminLeaveRequests"
            },
            {
                id: "quota",
                text: "Quota Management",
                icon: "sap-icon://key-user-settings",
                route: "QuotaManagement"
            },
            {
                id: "leaveType",
                text: "Leave Types",
                icon: "sap-icon://list",
                route: "AdminLeaveTypes"
            }
        ]
    };
    return new JSONModel(oData);
}
