/*global QUnit*/
import Controller from "zleave/zleave/controller/Requests.controller";

QUnit.module("Requests Controller");

QUnit.test("I should test the Requests controller", function (assert: Assert) {
	const oController = new Controller();
	oController.onInit();
	assert.ok(oController);
});