import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import JSONModel from "sap/ui/model/json/JSONModel";
import ErrorHandler from "./service/ErrorHandler";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import MessageBox from "sap/m/MessageBox";

/**
 * @namespace zleave.zleave
 */
export default class Component extends BaseComponent {

    public static metadata = {
        manifest: "json"
    };

    /**
     * The centralized error handler instance.
     * Stored so it stays alive for the entire component lifecycle.
     */
    private _oErrorHandler: ErrorHandler;

    /**
     * Global authorization-failed flag.
     * Set to true by ErrorHandler when a 403 is received.
     * Route guards and controllers read this via getAuthorizationFailed().
     */
    private _bAuthorizationFailed: boolean;

    /**
     * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
     * @public
     * @override
     */
    public init(): void {
        // call the base component's init function
        super.init();

        // Initialise the authorization flag
        this._bAuthorizationFailed = false;

        // -----------------------------------------------------------------
        // Create the shared "ui" model on the Component BEFORE the router
        // initialises and views are created. This guarantees that all child
        // controllers can access it via getOwnerComponent().getModel("ui")
        // even when async view creation makes App.controller.onInit() run
        // after a child controller's onInit().
        // -----------------------------------------------------------------
        this.setModel(
            new JSONModel({
                selectedSection: "dashboard",
                currentUser: {
                    is_hr: "",
                    is_manager: "",
                    is_admin: ""
                },
                stats: {
                    totalRequests: 0,
                    pendingRequests: 0,
                    approvedRequests: 0,
                    rejectedRequests: 0,
                    totalDays: 0
                },
                dashboard: {
                    annualLeaveRemaining: 0,
                    sickLeaveRemaining: 0,
                    unpaidLeaveUsed: 0,
                    myRequests: [],
                    upcomingLeaves: [],
                    notifications: []
                }
            }),
            "ui"
        );

        // enable routing
        this.getRouter().initialize();

        // set the device model
        this.setModel(createDeviceModel(), "device");

        // -----------------------------------------------------------------
        // Register the centralized ErrorHandler as soon as the OData model
        // is available. The default model (named "") is the OData V2 model
        // configured in manifest.json under sap.ui5 > models.
        // -----------------------------------------------------------------
        this._initErrorHandler();

        // -----------------------------------------------------------------
        // Route guard: intercept every route-matched event and redirect to
        // "Unauthorized" if authorization has already failed.
        // -----------------------------------------------------------------
        this._attachRouteGuard();
    }

    // -----------------------------------------------------------------------
    // Public API – used by ErrorHandler and controllers
    // -----------------------------------------------------------------------

    /**
     * Called by ErrorHandler when a 403 is detected.
     * Sets the global authorization-failed flag on the component.
     */
    public setAuthorizationFailed(bFailed: boolean): void {
        this._bAuthorizationFailed = bFailed;
    }

    /**
     * Returns the current authorization-failed state.
     * Controllers can call this in onInit / onPatternMatched to exit early.
     *
     * @example
     * const bFailed = (this.getOwnerComponent() as Component).getAuthorizationFailed();
     * if (bFailed) { return; }
     */
    public getAuthorizationFailed(): boolean {
        return this._bAuthorizationFailed;
    }

    // -----------------------------------------------------------------------
    // Private – ErrorHandler initialisation
    // -----------------------------------------------------------------------

    /**
     * Retrieves the default OData V2 model and hands it to the ErrorHandler.
     * If the model is not yet ready (metadata still loading), the handler's
     * attachMetadataFailed listener will still fire when it eventually fails.
     */
    private _initErrorHandler(): void {
        // The default model ("")  is the OData V2 model from manifest.json
        const oModel = this.getModel() as InstanceType<typeof ODataModel> | undefined;

        if (!oModel) {
            // Should never happen in a manifest-driven app, but guard anyway.
            return;
        }

        // ErrorHandler constructor registers all listeners immediately
        this._oErrorHandler = new ErrorHandler(oModel, this);
    }

    // -----------------------------------------------------------------------
    // Private – Route guard
    // -----------------------------------------------------------------------

    /**
     * Attaches a global routeMatched listener to the router.
     *
     * When a route is matched AND authorization has already failed, we
     * immediately redirect to the "Unauthorized" route.
     *
     * Additionally, we check route-level permissions to prevent Employee role
     * users from accessing Admin screens.
     */
    private _attachRouteGuard(): void {
        const oRouter = this.getRouter();

        if (!oRouter) {
            return;
        }

        oRouter.attachRouteMatched((oEvent: any): void => {
            // Get the name of the route that was just matched
            const sRouteName: string = oEvent.getParameter("name") as string;

            // Skip the guard for the Unauthorized route itself
            if (sRouteName === "Unauthorized") {
                return;
            }

            // If authorization failed, redirect away from the protected route
            if (this._bAuthorizationFailed) {
                oRouter.navTo("Unauthorized", {}, true /* replace history */);
                return;
            }

            // Get permissions allowed for the route
            const aAllowedRoles = ROUTE_PERMISSIONS[sRouteName];
            if (!aAllowedRoles) {
                // If route is not in permission config, allow by default
                return;
            }

            // Retrieve current user
            const oUiModel = this.getModel("ui") as InstanceType<typeof JSONModel> | undefined;
            const oCurrentUser = oUiModel?.getProperty("/currentUser");

            // If currentUser is null or has not been loaded (no role and no employeeId)
            if (!oCurrentUser || (!oCurrentUser.employeeId && !oCurrentUser.role)) {
                // Keep app busy while we load user
                const oRootControl = this.getRootControl() as any;
                if (oRootControl && typeof oRootControl.setBusy === "function") {
                    oRootControl.setBusy(true);
                }

                this.getCurrentUser().then((oUser: any) => {
                    if (oRootControl && typeof oRootControl.setBusy === "function") {
                        oRootControl.setBusy(false);
                    }
                    this._checkRoutePermissions(sRouteName, oUser);
                }).catch((oErr: any) => {
                    if (oRootControl && typeof oRootControl.setBusy === "function") {
                        oRootControl.setBusy(false);
                    }
                    console.error("[Component] Failed to load current user in guard:", oErr);
                    // On error, default to employee / dashboard route to prevent crash
                    oRouter.navTo("dashboard", {}, true);
                });
                return;
            }

            // User is already loaded, check permissions synchronously
            this._checkRoutePermissions(sRouteName, oCurrentUser);
        }, this);
    }

    /**
     * Checks if the user is authorized to access the given route.
     * Redirects to dashboard and displays an error MessageBox if unauthorized.
     */
    private _checkRoutePermissions(sRouteName: string, oCurrentUser: any): void {
        const aAllowedRoles = ROUTE_PERMISSIONS[sRouteName];
        if (!aAllowedRoles) {
            return;
        }

        // Determine user roles
        const aUserRoles = ["Employee"];
        if (oCurrentUser) {
            if (oCurrentUser.is_admin === "X" || oCurrentUser.is_admin === "true" || oCurrentUser.is_admin === "1" || oCurrentUser.role === "Admin") {
                aUserRoles.push("Admin");
            }
            if (oCurrentUser.is_hr === "X" || oCurrentUser.is_hr === "true" || oCurrentUser.is_hr === "1" || oCurrentUser.role === "HR") {
                aUserRoles.push("HR");
            }
            if (oCurrentUser.is_manager === "X" || oCurrentUser.is_manager === "true" || oCurrentUser.is_manager === "1" || oCurrentUser.role === "Manager") {
                aUserRoles.push("Manager");
            }
        }

        // Check if user has at least one role allowed for the route
        const bAuthorized = aAllowedRoles.some((sRole) => aUserRoles.includes(sRole));
        if (bAuthorized) {
            return;
        }

        // Unauthorized: Display message and redirect to default allowed route (Dashboard)
        MessageBox.error("You are not authorized to view this page.", {
            actions: [MessageBox.Action.CLOSE],
            onClose: (): void => {
                const oRouter = this.getRouter();
                if (oRouter) {
                    oRouter.navTo("Dashboard", {}, true /* replace history */);
                }
            }
        });
    }

    /**
     * Retrieves the current user details from OData service (/Employee) based on SAP Username.
     * Caches the result on the UI model so it's only fetched once per session.
     */
    public async getCurrentUser(): Promise<{ registered: boolean; employeeId: string; employeeName: string; role: string; is_manager: string; is_hr: string; is_admin: string; accessRolesText?: string; email?: string; department?: string }> {
        const oUiModel = this.getModel("ui") as InstanceType<typeof JSONModel> | undefined;
        if (!oUiModel) {
            return { registered: false, employeeId: "", employeeName: "", role: "Employee", is_manager: "", is_hr: "", is_admin: "", accessRolesText: "Employee", email: "", department: "" };
        }

        const oCachedUser = oUiModel.getProperty("/currentUser") as any;
        if (oCachedUser && oCachedUser.employeeId && oCachedUser.role) {
            if (!oCachedUser.accessRolesText) {
                oCachedUser.accessRolesText = [
                    (oCachedUser.is_admin === "X" || oCachedUser.is_admin === "true" || oCachedUser.is_admin === "1") ? "Admin" : "",
                    (oCachedUser.is_hr === "X" || oCachedUser.is_hr === "true" || oCachedUser.is_hr === "1") ? "HR" : "",
                    (oCachedUser.is_manager === "X" || oCachedUser.is_manager === "true" || oCachedUser.is_manager === "1") ? "Manager" : ""
                ].filter(Boolean).join(", ") || "Employee";
                oUiModel.setProperty("/currentUser", oCachedUser);
            }
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
                console.error("[Component] fetch /sap/bc/ui2/start_up failed:", oErr);
            }
        }

        const oModel = this.getModel() as InstanceType<typeof ODataModel> | undefined;
        if (oModel) {
            try {
                const oResult = await new Promise<any>((resolve, reject) => {
                    const mParameters: any = {
                        success: (oDataSuccess: any) => resolve(oDataSuccess),
                        error: (oError: any) => reject(oError)
                    };
                    if (sSapUser) {
                        mParameters.filters = [new Filter("SapUserName", FilterOperator.EQ, sSapUser)];
                    }
                    oModel.read("/Employee", mParameters);
                });

                let oEmp = oResult && oResult.results && oResult.results.length > 0 ? oResult.results[0] : null;

                if (!oEmp) {
                    // Fallback to fetch first available employee
                    const oAllResults = await new Promise<any>((resolve, reject) => {
                        oModel.read("/Employee", {
                            success: (oDataSuccess: any) => resolve(oDataSuccess),
                            error: (oError: any) => reject(oError)
                        });
                    });
                    if (oAllResults && oAllResults.results && oAllResults.results.length > 0) {
                        oEmp = oAllResults.results[0];
                    }
                }

                if (oEmp) {
                    const sAccessRolesText = [
                        (oEmp["IsAdmin"] === "X" || oEmp["IsAdmin"] === "true" || oEmp["IsAdmin"] === "1") ? "Admin" : "",
                        (oEmp["IsHR"] === "X" || oEmp["IsHR"] === "true" || oEmp["IsHR"] === "1") ? "HR" : "",
                        (oEmp["IsManager"] === "X" || oEmp["IsManager"] === "true" || oEmp["IsManager"] === "1") ? "Manager" : ""
                    ].filter(Boolean).join(", ") || "Employee";

                    const oUserObj = {
                        registered: true,
                        employeeId: String(oEmp["EmployeeId"] ?? ""),
                        employeeName: String(oEmp["FullName"] ?? oEmp["SapUserName"] ?? ""),
                        id: sSapUser || String(oEmp["SapUserName"] ?? ""),
                        displayName: String(oEmp["FullName"] ?? oEmp["SapUserName"] ?? ""),
                        role: String(oEmp["PositionTitle"] ?? "Employee"),
                        is_manager: String(oEmp["IsManager"] ?? ""),
                        is_hr: String(oEmp["IsHR"] ?? ""),
                        is_admin: String(oEmp["IsAdmin"] ?? ""),
                        accessRolesText: sAccessRolesText,
                        email: String(oEmp["Email"] ?? ""),
                        department: String(oEmp["Department"] ?? "")
                    };
                    oUiModel.setProperty("/currentUser", oUserObj);
                    return oUserObj;
                }
            } catch (oErr) {
                console.error("[Component] Querying Employee failed:", oErr);
            }
        }

        const oEmptyUser = {
            registered: false,
            employeeId: "",
            employeeName: "",
            role: "Employee",
            is_manager: "",
            is_hr: "",
            is_admin: "",
            accessRolesText: "Employee",
            email: "",
            department: ""
        };
        oUiModel.setProperty("/currentUser", oEmptyUser);
        return oEmptyUser;
    }
}

// -----------------------------------------------------------------------------
// Route Permission Configuration
// -----------------------------------------------------------------------------
const ROUTE_PERMISSIONS: Record<string, string[]> = {
    // Exact keys from the prompt
    "Dashboard": ["Employee", "Admin", "HR"],
    "Requests": ["Employee", "Admin", "HR"],
    "CreateRequest": ["Employee", "Admin", "HR"],
    "AdminDashboard": ["Admin", "HR"],
    "AdminEmployees": ["Admin", "HR"],
    "QuotaManagement": ["Admin", "HR"],
    "LeaveTypeManagement": ["Admin", "HR"],
    "HolidayManagement": ["Admin", "HR"],

    // Case-matched routes from manifest.json
    "dashboard": ["Employee", "Admin", "HR"],
    "requests": ["Employee", "Admin", "HR"],
    "EmployeeLeaveRequestDetail": ["Employee", "Admin", "HR"],
    "AdminLeaveRequestDetail": ["Admin", "HR"],
    "createRequest": ["Employee", "Admin", "HR"],
    "myLeaveCalendar": ["Employee", "Admin", "HR", "Manager"],
    "AdminShell": ["Admin", "HR"],
    "AdminLeaveRequests": ["Admin", "HR"],
    "AdminLeaveTypes": ["Admin", "HR"],
    "AdminAuditLog": ["Admin", "HR"],
    "AdminAuditLogDetail": ["Admin", "HR"],
    "Unauthorized": ["Employee", "Admin", "HR"]
};