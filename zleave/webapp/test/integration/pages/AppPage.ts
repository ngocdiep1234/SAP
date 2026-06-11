import Opa5 from "sap/ui/test/Opa5";

const sViewName = "App";

export default class AppPage extends Opa5 {
	// Actions


	// Assertions
	public iShouldSeeTheApp(): this {
    this.waitFor({
        id: "app",
        viewName: sViewName,
        success: () => {
            Opa5.assert.ok(true, `The ${sViewName} view is displayed`);
        },
        errorMessage: `Did not find the ${sViewName} view`
    });

    return this;
}

}

