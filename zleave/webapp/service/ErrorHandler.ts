import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import MessageBox from "sap/m/MessageBox";
import UIComponent from "sap/ui/core/UIComponent";

/**
 * @namespace zleave.zleave.service
 *
 * ErrorHandler
 * ============
 * Centralized OData error handler for the application.
 *
 * Attach this handler once during Component.init() to intercept ALL
 * OData V2 errors globally – metadata, read, create/update/delete,
 * and batch requests.
 *
 * Status code strategy:
 *   401 → Redirect to SAP authentication / login page
 *   403 → Navigate to the "Unauthorized" route
 *   500 → Show a technical error MessageBox
 *     0 → Show a network / server-unreachable MessageBox
 */
export default class ErrorHandler {

    /** The OData V2 model this handler is attached to. */
    private _oModel: InstanceType<typeof ODataModel>;

    /** The owning UIComponent – used to access the router. */
    private _oComponent: InstanceType<typeof UIComponent>;

    /**
     * Tracks whether a 403 has already been handled this session.
     * Once true, further OData events are ignored to avoid duplicate dialogs.
     */
    private _bAuthorizationFailed: boolean;

    /**
     * Tracks whether a technical-error dialog is already open,
     * so we do not stack multiple identical MessageBoxes.
     */
    private _bErrorDialogOpen: boolean;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /**
     * Creates and immediately registers the ErrorHandler on the provided model.
     *
     * @param oModel     - The application's default OData V2 model.
     * @param oComponent - The owning UIComponent (used for router access).
     */
    public constructor(
        oModel: InstanceType<typeof ODataModel>,
        oComponent: InstanceType<typeof UIComponent>
    ) {
        this._oModel = oModel;
        this._oComponent = oComponent;
        this._bAuthorizationFailed = false;
        this._bErrorDialogOpen = false;

        this._registerHandlers();
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Returns true if authorization has already failed (403 was received).
     * Controllers and route guards can call this to skip further OData reads.
     */
    public isAuthorizationFailed(): boolean {
        return this._bAuthorizationFailed;
    }

    // -----------------------------------------------------------------------
    // Private – handler registration
    // -----------------------------------------------------------------------

    /**
     * Attaches all relevant OData V2 error listeners to the model.
     * Called once from the constructor.
     */
    private _registerHandlers(): void {
        // 1. Metadata load failure (triggered when $metadata cannot be fetched)
        this._oModel.attachMetadataFailed(this._onMetadataFailed, this);

        // 2. Any single OData request failure (read / create / update / delete)
        this._oModel.attachRequestFailed(this._onRequestFailed, this);

        // 3. $batch request failure (SAP-specific batch event)
        //    attachBatchRequestFailed is available on ODataModel V2.
        //    We guard with a type-cast because the TS types may not expose it.
        const oModelAny = this._oModel as any;
        if (typeof oModelAny.attachBatchRequestFailed === "function") {
            oModelAny.attachBatchRequestFailed(this._onRequestFailed, this);
        }
    }

    // -----------------------------------------------------------------------
    // Private – event callbacks
    // -----------------------------------------------------------------------

    /**
     * Handles the attachMetadataFailed event.
     * The event parameter contains the XMLHttpRequest response.
     *
     * @param oEvent - UI5 base Event carrying the metadata failure details.
     */
    private _onMetadataFailed(oEvent: any): void {
        const oParams = oEvent.getParameters();
        // responseText may contain a JSON OData error body
        const iStatus = this._extractStatusCode(oParams);
        this._handleStatusCode(iStatus, oParams, true);
    }

    /**
     * Handles attachRequestFailed / attachBatchRequestFailed events.
     *
     * @param oEvent - UI5 base Event carrying the request failure details.
     */
    private _onRequestFailed(oEvent: any): void {
        // Skip if authorization already failed – avoid duplicate navigation
        if (this._bAuthorizationFailed) {
            return;
        }

        const oParams = oEvent.getParameters();
        const iStatus = this._extractStatusCode(oParams);
        this._handleStatusCode(iStatus, oParams, false);
    }

    // -----------------------------------------------------------------------
    // Private – status code routing
    // -----------------------------------------------------------------------

    /**
     * Routes a resolved HTTP status code to the appropriate action.
     *
     * @param iStatus - Numeric HTTP status code (0 means network error).
     * @param oParams - Raw event parameters (used for error message extraction).
     * @param bIsMetadata - Indicates if the failure came from metadata load.
     */
    private _handleStatusCode(iStatus: number, oParams: any, bIsMetadata: boolean): void {
        switch (iStatus) {
            case 401:
                this._handleUnauthorized();
                break;

            case 403:
                if (bIsMetadata) {
                    this._handleForbidden();
                }
                break;

            case 500:
                this._handleServerError(oParams);
                break;

            case 0:
                this._handleNetworkError();
                break;

            default:
                // Other errors (404, 400, etc.) are handled per-controller.
                break;
        }
    }

    // -----------------------------------------------------------------------
    // Private – individual handlers
    // -----------------------------------------------------------------------

    /**
     * 401 – The user's session has expired or credentials are missing.
     * Redirect to the SAP ICF logon page so the platform can re-authenticate.
     */
    private _handleUnauthorized(): void {
        // Redirect to SAP Fiori launchpad / ICF login.
        // The platform will redirect back to the app after authentication.
        window.location.href = "/sap/public/bc/icf/logon";
    }

    /**
     * 403 – The user is authenticated but lacks authorization for this app.
     * Sets the global authorizationFailed flag and navigates to the
     * dedicated "Unauthorized" view.
     */
    private _handleForbidden(): void {
        // Guard: only process once per session
        if (this._bAuthorizationFailed) {
            return;
        }

        // 1. Set the global flag – route guards will check this
        this._bAuthorizationFailed = true;

        // 2. Expose the flag on the component so controllers can read it
        const oComponentData = this._oComponent as any;
        if (typeof oComponentData.setAuthorizationFailed === "function") {
            oComponentData.setAuthorizationFailed(true);
        }

        // 3. Navigate immediately to the Unauthorized page
        const oRouter = this._oComponent.getRouter();
        if (oRouter) {
            oRouter.navTo("Unauthorized", {}, true /* replace history */);
        }
    }



    /**
     * 500 – Backend technical / ABAP short-dump error.
     * Shows a single MessageBox to inform the user without duplicates.
     *
     * @param oParams - Raw event parameters used to extract the error message.
     */
    private _handleServerError(oParams: any): void {
        if (this._bErrorDialogOpen) {
            return;
        }

        this._bErrorDialogOpen = true;
        const sMessage = this._extractErrorMessage(oParams);

        MessageBox.error(
            sMessage || "A technical error occurred on the server. Please contact your system administrator.",
            {
                title: "Technical Error",
                onClose: (): void => {
                    this._bErrorDialogOpen = false;
                }
            }
        );
    }

    /**
     * 0 – The request could not reach the server at all (no network / VPN).
     * Shows a single MessageBox to inform the user without duplicates.
     */
    private _handleNetworkError(): void {
        if (this._bErrorDialogOpen) {
            return;
        }

        this._bErrorDialogOpen = true;

        MessageBox.error(
            "Unable to reach the server. Please check your network connection and try again.",
            {
                title: "Network Error",
                onClose: (): void => {
                    this._bErrorDialogOpen = false;
                }
            }
        );
    }

    // -----------------------------------------------------------------------
    // Private – helpers
    // -----------------------------------------------------------------------

    /**
     * Tries to extract a numeric HTTP status code from the OData event parameters.
     * The OData V2 event may provide it under different property names depending
     * on whether it is a metadata, request, or batch failure.
     *
     * @param oParams - Raw event parameters object.
     * @returns Numeric status code, or 0 if none could be determined.
     */
    private _extractStatusCode(oParams: any): number {
        // Direct statusCode property (most request failures)
        if (oParams && oParams.statusCode !== undefined) {
            return parseInt(String(oParams.statusCode), 10) || 0;
        }

        // response.statusCode (metadata failures)
        if (oParams && oParams.response && oParams.response.statusCode !== undefined) {
            return parseInt(String(oParams.response.statusCode), 10) || 0;
        }

        // responseText embedded JSON may carry the status
        if (oParams && oParams.responseText) {
            try {
                const oParsed = JSON.parse(oParams.responseText);
                if (oParsed && oParsed.error && oParsed.error.code) {
                    const iCode = parseInt(String(oParsed.error.code), 10);
                    if (!isNaN(iCode)) {
                        return iCode;
                    }
                }
            } catch {
                // JSON parse failed – ignore
            }
        }

        return 0;
    }

    /**
     * Attempts to extract a human-readable error message from event parameters.
     *
     * @param oParams - Raw event parameters object.
     * @returns A string message, or an empty string if nothing was found.
     */
    private _extractErrorMessage(oParams: any): string {
        if (!oParams) {
            return "";
        }

        if (oParams.responseText) {
            try {
                const oParsed = JSON.parse(oParams.responseText);
                const sMsg = oParsed && oParsed.error && oParsed.error.message && oParsed.error.message.value;
                if (sMsg) {
                    return String(sMsg);
                }
            } catch {
                // ignore parse failure
            }
        }

        if (oParams.message) {
            return String(oParams.message);
        }

        return "";
    }
}
