
import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import MessageToast from "sap/m/MessageToast";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Label from "sap/m/Label";
import Input from "sap/m/Input";
import DatePicker from "sap/m/DatePicker";
import TextArea from "sap/m/TextArea";
import VBox from "sap/m/VBox";

export default class Requests extends Controller {

    public onInit(): void {
        // nothing special here; view benefits from app-level ui model
    }

    public onSearch(oEvent: any): void {
        const sQuery = oEvent.getParameter && (oEvent.getParameter("query") || oEvent.getParameter("newValue")) || "";
        const aFilters: any[] = [];
        if (sQuery) {
            aFilters.push(new Filter({
                filters: [
                    new Filter("RequestID", FilterOperator.Contains, sQuery),
                    new Filter("EmployeeID", FilterOperator.Contains, sQuery),
                    new Filter("DepartmentID", FilterOperator.Contains, sQuery),
                    new Filter("EmployeeName", FilterOperator.Contains, sQuery),
                    new Filter("LeaveType", FilterOperator.Contains, sQuery)
                ],
                and: false
            }));
        }
        const oTable = (this as any).byId("table");
        const oBinding = oTable.getBinding("items");
        oBinding.filter(aFilters.length ? aFilters : []);
    }

    public onFilter(oEvent: any): void {
        const sValue = oEvent.getParameter && (oEvent.getParameter("query") || oEvent.getParameter("newValue")) || "";
        const aFilters: any[] = [];
        if (sValue) {
            aFilters.push(new Filter("EmployeeName", FilterOperator.Contains, sValue));
        }
        const oTable = (this as any).byId("table");
        oTable.getBinding("items").filter(aFilters);
    }

    public onRefresh(): void {
        const oModel = (this as any).getView().getModel();
        if (oModel && oModel.refresh) {
            oModel.refresh(true);
            MessageToast.show((this as any).getView().getModel("i18n").getProperty("refreshed"));
        }
    }

    private _updateStatus(sPath: string, sStatus: string): void {
        const oModel = (this as any).getView().getModel();
        const oPayload = { Status: sStatus } as any;
        oModel.update(sPath, oPayload, {
            success: () => {
                MessageToast.show((this as any).getView().getModel("i18n").getProperty("updateSuccess"));
                // refresh app-level stats
                try { (this as any).getView().getModel().refresh(true); } catch { }
            },
            error: () => { MessageToast.show((this as any).getView().getModel("i18n").getProperty("updateError")); }
        });
    }

    public onApprove(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sPath = oContext.getPath();
        const oDlg = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("confirmApproveTitle"),
            type: "Message",
            content: [],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("yes"),
                press: () => {
                    this._updateStatus(sPath, "Approved");
                    oDlg.close();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("no"), press: () => oDlg.close() })
        });
        oDlg.open();
    }

    public onReject(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sPath: string = String(oContext.getPath());
        const oDlg = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("confirmRejectTitle"),
            type: "Message",
            content: [],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("yes"),
                press: () => {
                    this._updateStatus(sPath, "Rejected");
                    oDlg.close();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("no"), press: () => oDlg.close() })
        });
        oDlg.open();
    }

    public onOpenAttachment(oEvent: any): void {
        const oSource = oEvent.getSource();
        const oContext = oSource.getParent().getBindingContext();
        if (!oContext) { return; }
        const sAttachment = oContext.getProperty("AttachmentURL") as string;

        if (sAttachment) {
            window.open(sAttachment, "_blank");
        } else {
            MessageToast.show(
                (this as any).getView().getModel("i18n").getProperty("noAttachment")
            );
        }    
    }

    public onCreate(): void {
        const sViewId = (this as any).getView().getId();
        const oEmpId = new Input(sViewId + "-empId");
        const oEmpName = new Input(sViewId + "-empName");
        const oLeaveType = new Input(sViewId + "-leaveType");
        const oStart = new DatePicker(sViewId + "-start");
        const oEnd = new DatePicker(sViewId + "-end");
        const oReason = new TextArea(sViewId + "-reason");

        const oVBox = new VBox({ items: [
            new Label({ text: (this as any).getView().getModel("i18n").getProperty("employeeId") }), oEmpId,
            new Label({ text: (this as any).getView().getModel("i18n").getProperty("employeeName") }), oEmpName,
            new Label({ text: (this as any).getView().getModel("i18n").getProperty("leaveType") }), oLeaveType,
            new Label({ text: (this as any).getView().getModel("i18n").getProperty("startDate") }), oStart,
            new Label({ text: (this as any).getView().getModel("i18n").getProperty("endDate") }), oEnd,
            new Label({ text: (this as any).getView().getModel("i18n").getProperty("reason") }), oReason
        ] });

        const oDialog = new Dialog({
            title: (this as any).getView().getModel("i18n").getProperty("createTitle"),
            content: [oVBox],
            beginButton: new Button({
                text: (this as any).getView().getModel("i18n").getProperty("save"),
                press: () => {
                    const oEntry: any = {
                        EmployeeID: oEmpId.getValue(),
                        EmployeeName: oEmpName.getValue(),
                        LeaveType: oLeaveType.getValue(),
                        StartDate: oStart.getDateValue() ? ((oStart.getDateValue() as Date).toISOString()) : null,
                        EndDate: oEnd.getDateValue() ? ((oEnd.getDateValue() as Date).toISOString()) : null,
                        Reason: oReason.getValue(),
                        Status: "Pending"
                    };
                    const oModel = (this as any).getView().getModel();
                    oModel.create("/LeaveRequest", oEntry, {
                        success: () => {
                            MessageToast.show((this as any).getView().getModel("i18n").getProperty("createSuccess"));
                            try { (this as any).getView().getModel().refresh(true); } catch { }
                        },
                        error: () => { MessageToast.show((this as any).getView().getModel("i18n").getProperty("createError")); }
                    });
                    oDialog.close();
                    oDialog.destroy();
                }
            }),
            endButton: new Button({ text: (this as any).getView().getModel("i18n").getProperty("cancel"), press: () => { oDialog.close(); oDialog.destroy(); } }),
            afterClose: () => { oDialog.destroy(); }
        });
        oDialog.open();
    }
}
