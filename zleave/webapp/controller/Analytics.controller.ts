import Controller from "sap/ui/core/mvc/Controller";

export default class Analytics extends Controller {
    public onInit(): void {
        const oRouter = (this as any).getOwnerComponent().getRouter();
        oRouter.getRoute("analytics").attachPatternMatched(this._onPatternMatched, this);
    }

    private _onPatternMatched(): void {
        const oUiModel = this.getView().getModel("ui") as any;
        if (oUiModel) {
            oUiModel.setProperty("/selectedSection", "analytics");
        }
    }
}
