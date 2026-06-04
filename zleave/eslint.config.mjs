import fioriTools from "@sap-ux/eslint-plugin-fiori-tools";

export default [
    ...fioriTools.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-explicit-any": "off"
        }
    }
];