import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";

/**
 * @namespace zleave.zleave.controller
 */
export default class App extends Controller {

    public onInit(): void {
        const oView = (this as any).getView();
        // app-level UI model used by multiple views
        oView.setModel(new JSONModel({ selectedSection: "dashboard", stats: { totalRequests: 0, pendingRequests: 0, approvedRequests: 0, rejectedRequests: 0, totalDays: 0 } }), "ui");
    }

    public onNavSelect(oEvent: any): void {
        const oItem = oEvent.getParameter && oEvent.getParameter("item");
        const sKey = oItem && oItem.getKey && oItem.getKey();
        if (!sKey) { return; }
        // update UI model
        (this as any).getView().getModel("ui").setProperty("/selectedSection", sKey);
        // navigate using router so URL updates
        try {
            const oRouter = (this as any).getOwnerComponent().getRouter();
            if (oRouter && oRouter.navTo) { oRouter.navTo(sKey); }
        } catch (e) { /* ignore */ }
    }
}