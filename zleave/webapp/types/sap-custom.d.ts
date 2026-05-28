declare module "sap/ui/core/mvc/Controller" {
    const Controller: any;
    export default Controller;
}
declare module "sap/ui/model/Filter" {
    const Filter: any;
    export default Filter;
}
declare module "sap/ui/model/FilterOperator" {
    const FilterOperator: any;
    export default FilterOperator;
}
declare module "sap/m/MessageToast" {
    const MessageToast: any;
    export default MessageToast;
}
declare module "sap/m/Dialog" {
    const Dialog: any;
    export default Dialog;
}
declare module "sap/m/Button" {
    const Button: any;
    export default Button;
}
declare module "sap/m/Label" {
    const Label: any;
    export default Label;
}
declare module "sap/m/Input" {
    const Input: any;
    export default Input;
}
declare module "sap/m/DatePicker" {
    const DatePicker: any;
    export default DatePicker;
}
declare module "sap/m/TextArea" {
    const TextArea: any;
    export default TextArea;
}
declare module "sap/m/VBox" {
    const VBox: any;
    export default VBox;
}
declare module "sap/ui/model/json/JSONModel" {
    const JSONModel: any;
    export default JSONModel;
}

// Generic fallback for other sap modules used in project
declare module "sap/*" {
    const anyModule: any;
    export default anyModule;
}
