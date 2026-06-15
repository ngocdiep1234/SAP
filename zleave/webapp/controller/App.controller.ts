import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace zleave.zleave.controller
 */
export default class App extends Controller {

    public onInit(): void {
        const oView = this.getView();

        oView.setModel(
            new JSONModel({
                selectedSection: "dashboard",
                stats: {
                    totalRequests: 0,
                    pendingRequests: 0,
                    approvedRequests: 0,
                    rejectedRequests: 0,
                    totalDays: 0
                }
            }),
            "ui"
        );

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

        // Hide / show the side navigation list
        const oSideNav = this.getView().byId("sideNav") as any;
        if (oSideNav && typeof oSideNav.setVisible === "function") {
            oSideNav.setVisible(!bIsUnauthorized);
        }

        // Collapse / expand the ToolPage side panel itself so no empty
        // grey strip remains on the left when the nav list is hidden.
        const oToolPage = this.getView().byId("toolPage") as any;
        if (oToolPage && typeof oToolPage.setSideExpanded === "function") {
            oToolPage.setSideExpanded(!bIsUnauthorized);
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
}