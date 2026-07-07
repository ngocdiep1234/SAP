import BaseComponent from "sap/ui/core/UIComponent";
import { createDeviceModel } from "./model/models";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import JSONModel from "sap/ui/model/json/JSONModel";
import ErrorHandler from "./service/ErrorHandler";

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
     * immediately redirect to the "Unauthorized" route – preventing the
     * user from reaching any protected page via the browser back button
     * or direct URL manipulation.
     *
     * The "Unauthorized" route itself is excluded from the guard to avoid
     * an infinite redirect loop.
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
            }
        }, this);
    }
}