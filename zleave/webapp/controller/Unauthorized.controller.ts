import Controller from "sap/ui/core/mvc/Controller";
import MessageBox from "sap/m/MessageBox";

/**
 * @namespace zleave.zleave.controller
 *
 * Unauthorized
 * ============
 * Controller for the Unauthorized (Access Denied) view.
 *
 * This controller is intentionally minimal – the view is a dead-end page
 * and the only meaningful action is navigating away to the launchpad.
 */
export default class Unauthorized extends Controller {

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    public onInit(): void {
        // Nothing to initialise. The view is purely informational.
    }

    // -----------------------------------------------------------------------
    // Event handlers
    // -----------------------------------------------------------------------

    /**
     * Ask for confirmation and redirect to the SAP ICF logoff URL.
     * Mirrors the logout flow in Dashboard.controller.ts.
     */
    public onLogout(): void {
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
