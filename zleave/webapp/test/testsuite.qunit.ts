declare global {
    interface Window {
        suite: () => unknown;
    }
}

declare const parent: {
    jsUnitTestSuite: new () => {
        addTestPage: (page: string) => void;
    };
};

window.suite = function (): unknown {
    const oSuite = new parent.jsUnitTestSuite();

    const sContextPath =
        location.pathname.substring(
            0,
            location.pathname.lastIndexOf("/") + 1
        );

    oSuite.addTestPage(
        sContextPath + "unit/unitTests.qunit.html"
    );

    oSuite.addTestPage(
        sContextPath + "integration/opaTests.qunit.html"
    );

    return oSuite;
};

export {};