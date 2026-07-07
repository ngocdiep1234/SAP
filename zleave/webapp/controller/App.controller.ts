import Controller from "sap/ui/core/mvc/Controller";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace zleave.zleave.controller
 */
export default class App extends Controller {

    public onInit(): void {
        const oView = this.getView();

        // The "ui" model is created in Component.init() before any view is loaded.
        // Bind it to this view so XML bindings like {ui>/selectedSection} work.
        const oUiModel = (this.getOwnerComponent() as any).getModel("ui");
        if (oUiModel) {
            oView.setModel(oUiModel, "ui");
        }

        // ---------------------------------------------------------------
        // Sidebar visibility guard
        // Hide the side navigation whenever the "Unauthorized" route is
        // matched so the user cannot click away to protected pages.
        // Restore it for every other route (in case of future navigation).
        // ---------------------------------------------------------------
        const oOwnerComponent = this.getOwnerComponent();
        if (oOwnerComponent) {
            const oRouter = (oOwnerComponent as any).getRouter();
            if (oRouter) {
                oRouter.attachRouteMatched(this._onRouteMatched, this);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Private – route-matched handler
    // -----------------------------------------------------------------------

    /**
     * Fired every time a route is matched.
     * Toggles the ToolPage side navigation based on whether the current
     * route is the "Unauthorized" dead-end page.
     *
     * @param oEvent - UI5 router RouteMatched event.
     */
    private _onRouteMatched(oEvent: any): void {
        const sRouteName: string = oEvent.getParameter("name") as string;
        const bIsUnauthorized = sRouteName === "Unauthorized";
        const bIsAdminRoute = sRouteName.startsWith("Admin") || sRouteName === "QuotaManagement" || sRouteName === "AdminShell";
        const bHideSidebar = bIsUnauthorized || bIsAdminRoute;

        // Hide / show the side navigation list
        const oSideNav = this.getView().byId("sideNav") as any;
        if (oSideNav && typeof oSideNav.setVisible === "function") {
            oSideNav.setVisible(!bHideSidebar);
        }

        // Collapse / expand the ToolPage side panel itself so no empty
        // grey strip remains on the left when the nav list is hidden.
        const oToolPage = this.getView().byId("toolPage") as any;
        if (oToolPage && typeof oToolPage.setSideExpanded === "function") {
            oToolPage.setSideExpanded(!bHideSidebar);
        }

        // Hide / show the main employee header on admin routes
        const oHeader = this.getView().byId("appHeader") as any;
        if (oHeader && typeof oHeader.setVisible === "function") {
            oHeader.setVisible(!bIsAdminRoute);
        }
    }

    // -----------------------------------------------------------------------
    // Public – side-nav item selection
    // -----------------------------------------------------------------------

    public onNavSelect(oEvent: any): void {

        const oItem = oEvent.getParameter("item") as {
            getKey: () => string;
        } | undefined;

        if (!oItem) {
            return;
        }

        const sKey = oItem.getKey();

        const oUiModel = this.getView().getModel("ui");

        oUiModel.setProperty("/selectedSection", sKey);

        try {
            const oOwnerComponent = this.getOwnerComponent();

            if (!oOwnerComponent) {
                return;
            }

            const oRouter = (oOwnerComponent as {
                getRouter(): {
                    navTo(route: string): void;
                };
            }).getRouter();

            oRouter.navTo(sKey);
        } catch {
            // ignore
        }
    }

    /**
     * Toggles the collapsible sidebar state
     */
    public onToggleSidebar(): void {
        const oToolPage = this.getView().byId("toolPage") as any;
        if (oToolPage && typeof oToolPage.getSideExpanded === "function") {
            const bExpanded = oToolPage.getSideExpanded();
            oToolPage.setSideExpanded(!bExpanded);
        }
    }

    /**
     * Handler for user profile click
     */
    public async onUserMenuPress(): Promise<void> {
        const oCurrentUser = await this._getCurrentUser();
        const sRoles = [
            (oCurrentUser.is_admin === "X" || oCurrentUser.is_admin === "true" || oCurrentUser.is_admin === "1") ? "Admin" : "",
            (oCurrentUser.is_hr === "X" || oCurrentUser.is_hr === "true" || oCurrentUser.is_hr === "1") ? "HR" : "",
            (oCurrentUser.is_manager === "X" || oCurrentUser.is_manager === "true" || oCurrentUser.is_manager === "1") ? "Manager" : ""
        ].filter(Boolean).join(", ") || "Employee";

        MessageBox.information(
            `Name: ${oCurrentUser.employeeName}\nID: ${oCurrentUser.employeeId}\nAccess Roles: ${sRoles}`,
            {
                title: "User Profile"
            }
        );
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
                    sSapUser = (oData["id"] as string) ??
                        (oData["userId"] as string) ??
                        (oData["name"] as string) ??
                        "";
                }
            } catch (oErr) {
                console.error("[App] fetch /sap/bc/ui2/start_up failed:", oErr);
            }
        }

        if (sSapUser) {
            const oModel = (this as any).getOwnerComponent().getModel() as InstanceType<typeof ODataModel> | undefined;
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
                        return oUserObj;
                    }
                } catch (oErr) {
                    console.error("[App] Querying Employee by SapUserName failed:", oErr);
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

    /**
     * Handler for user log out
     */
    public onLogoutPress(): void {
        MessageBox.confirm(
            "Are you sure you want to logout?",
            {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: (sAction: string): void => {
                    if (sAction === MessageBox.Action.YES) {
                        window.location.href = "/sap/public/bc/icf/logoff";
                    }
                }
            }
        );
    }
}