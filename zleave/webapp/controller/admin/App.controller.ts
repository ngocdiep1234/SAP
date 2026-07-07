import Controller from "sap/ui/core/mvc/Controller";
import Event from "sap/ui/base/Event";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageToast from "sap/m/MessageToast";
import MessageBox from "sap/m/MessageBox";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
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
     * Handler for logout press
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
