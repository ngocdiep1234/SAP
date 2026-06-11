import Opa5 from "sap/ui/test/Opa5";

const sViewName = "Dashboard";

export default class ZI_LEAVE_REQUESTPage extends Opa5 {
	// Actions


	// Assertions
	public iShouldSeeThePageView(): this {
    this.waitFor({
        id: "dashboardPage",
        viewName: sViewName,
        success: () => {
            Opa5.assert.ok(true, `The ${sViewName} view is displayed`);
        },
        errorMessage: `Did not find the ${sViewName} view`
    });

    return this;
	}
}


