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
    }

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