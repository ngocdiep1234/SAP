import Controller from "sap/ui/core/mvc/Controller";
import Event from "sap/ui/base/Event";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import { createNavModel } from "../../model/nav.model";

/**
 * @namespace zleave.zleave.controller.admin
 */
export default class App extends Controller {

    public onInit(): void {
        // Load the new independent sidebar model
        const oNavModel = createNavModel();
        this.getView().setModel(oNavModel, "nav");

        // Attach route-matched event to highlight the correct menu item based on current URL
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.attachRouteMatched(this._onRouteMatched, this);
    }

    /**
     * Event handler for sidebar item selection
     */
    public onNavItemPress(oEvent: any): void {
        const oItem = oEvent.getParameter("item") as any;
        if (!oItem) {
            return;
        }

        const sKey = oItem.getKey();
        const oNavModel = this.getView().getModel("nav") as InstanceType<typeof JSONModel>;
        const aItems = oNavModel.getProperty("/items") as any[];

        const oFound = aItems.find(item => item.id === sKey);
        if (oFound && oFound.route) {
            // Update model state
            oNavModel.setProperty("/selectedKey", sKey);
            // Navigate using the required rule
            this._navigate(oFound.route);
        }
    }

    /**
     * Navigation rule wrapper
     */
    private _navigate(route: string): void {
        const oComponent = (this as any).getOwnerComponent();
        if (oComponent) {
            oComponent.getRouter().navTo(route);
        }
    }

    /**
     * Toggles the collapsible sidebar state
     */
    public onToggleSidebar(): void {
        const oNavModel = this.getView().getModel("nav") as InstanceType<typeof JSONModel>;
        const bCollapsed = oNavModel.getProperty("/collapsed");
        oNavModel.setProperty("/collapsed", !bCollapsed);
    }

    /**
     * Mock handler for user menu press
     */
    public onUserMenuPress(): void {
        MessageToast.show("User profile settings (mock)");
    }

    /**
     * Mock handler for logout press
     */
    public onLogoutPress(): void {
        MessageToast.show("Logging out... (mock)");
    }

    /**
     * Synchronizes the sidebar selected key when browser navigation / direct routing occurs
     */
    private _onRouteMatched(oEvent: any): void {
        const sRouteName = oEvent.getParameter("name");
        const oNavModel = this.getView().getModel("nav") as InstanceType<typeof JSONModel>;
        if (!oNavModel) {
            return;
        }
        const aItems = oNavModel.getProperty("/items") as any[];
        const oFound = aItems.find(item => item.route === sRouteName);
        if (oFound) {
            oNavModel.setProperty("/selectedKey", oFound.id);
        }
    }
}
