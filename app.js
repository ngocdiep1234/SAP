sap.ui.getCore().attachInit(function () {
  const oData = {
    requests: [
      { selected: true, id: "R0001", employee: "Nguyễn An", type: "Phép năm", status: "Pending", statusState: "Warning", priority: "High", priorityState: "Error", manager: "A. Nguyễn", date: "12.05.2026" },
      { selected: false, id: "R0002", employee: "Lê Minh", type: "Ốm đau", status: "New", statusState: "Information", priority: "Medium", priorityState: "Warning", manager: "T. Phạm", date: "14.05.2026" },
      { selected: false, id: "R0003", employee: "Trần Vy", type: "Thai sản", status: "On Hold", statusState: "None", priority: "High", priorityState: "Error", manager: "B. Trần", date: "15.05.2026" },
      { selected: false, id: "R0004", employee: "Lê Long", type: "Không lương", status: "Resolved", statusState: "Success", priority: "Low", priorityState: "Success", manager: "L. Lê", date: "08.05.2026" }
    ],
    calendar: [
      { date: "04.05.2026", employee: "Lê Minh", type: "Ốm đau", status: "Confirmed" },
      { date: "12.05.2026", employee: "Nguyễn An", type: "Phép năm", status: "Confirmed" },
      { date: "18.05.2026", employee: "Trần Vy", type: "Không lương", status: "Confirmed" },
      { date: "22.05.2026", employee: "Team ABC", type: "Conflict", status: "4 people" }
    ],
    reports: [
      { employee: "Nguyễn An", leaveType: "Phép năm", used: "4 ngày", remaining: "8 ngày", department: "Sales" },
      { employee: "Lê Minh", leaveType: "Ốm đau", used: "2 ngày", remaining: "3 ngày", department: "Finance" },
      { employee: "Trần Vy", leaveType: "Không lương", used: "1 ngày", remaining: "0 ngày", department: "Engineering" }
    ]
  };

  const oModel = new sap.ui.model.json.JSONModel(oData);
  sap.ui.getCore().setModel(oModel);

  const oRequestForm = new sap.ui.layout.form.SimpleForm({
    maxContainerCols: 2,
    layout: "ResponsiveGridLayout",
    labelSpanL: 4,
    labelSpanM: 4,
    columnsL: 2,
    columnsM: 1,
    content: [
      new sap.m.Label({ text: "Loại nghỉ" }),
      new sap.m.Select({
        width: "100%",
        items: [
          new sap.ui.core.Item({ key: "annual", text: "Nghỉ phép năm" }),
          new sap.ui.core.Item({ key: "sick", text: "Ốm đau" }),
          new sap.ui.core.Item({ key: "unpaid", text: "Nghỉ không lương" }),
          new sap.ui.core.Item({ key: "maternity", text: "Thai sản" }),
          new sap.ui.core.Item({ key: "special", text: "Nghỉ đặc biệt" })
        ]
      }),
      new sap.m.Label({ text: "Ngày bắt đầu" }),
      new sap.m.DatePicker({ value: "2026-05-20" }),
      new sap.m.Label({ text: "Ngày kết thúc" }),
      new sap.m.DatePicker({ value: "2026-05-25" }),
      new sap.m.Label({ text: "Ghi chú" }),
      new sap.m.TextArea({ width: "100%", rows: 4, placeholder: "Lý do nghỉ, thông tin bổ sung..." }),
      new sap.m.Label({ text: "Đính kèm" }),
      new sap.m.Input({ width: "100%", placeholder: "Chọn file đính kèm (demo)" })
    ]
  });

  const oRequestPanel = new sap.m.Panel({
    headerText: "Nộp đơn nghỉ phép",
    expandable: false,
    content: [oRequestForm],
    footer: new sap.m.Toolbar({
      content: [
        new sap.m.ToolbarSpacer(),
        new sap.m.Button({ text: "Gửi phê duyệt", type: "Emphasized" })
      ]
    })
  });

  const oRequestCard = new sap.m.Panel({
    headerText: "Thông tin quota",
    expandable: false,
    content: [
      new sap.m.FlexBox({
        justifyContent: "SpaceBetween",
        wrap: "Wrap",
        items: [
          new sap.m.ObjectAttribute({ title: "Phép năm còn lại", text: "8 ngày" }),
          new sap.m.ObjectAttribute({ title: "Hạn mức", text: "Vượt 2 ngày" })
        ]
      })
    ]
  });

  const oApprovalTable = new sap.m.Table({
    inset: false,
    headerText: "Yêu cầu phê duyệt",
    columns: [
      new sap.m.Column({ header: new sap.m.Text({ text: "Request ID" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Nhân viên" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Loại" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Trạng thái" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Ưu tiên" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Quản lý" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Ngày" }) })
    ],
    items: {
      path: "/requests",
      template: new sap.m.ColumnListItem({
        cells: [
          new sap.m.Text({ text: "{id}" }),
          new sap.m.Text({ text: "{employee}" }),
          new sap.m.Text({ text: "{type}" }),
          new sap.m.ObjectStatus({ text: "{status}", state: "{statusState}" }),
          new sap.m.ObjectStatus({ text: "{priority}", state: "{priorityState}" }),
          new sap.m.Text({ text: "{manager}" }),
          new sap.m.Text({ text: "{date}" })
        ]
      })
    }
  });

  const oApprovalFilterBar = new sap.m.Toolbar({
    content: [
      new sap.m.Label({ text: "Status" }),
      new sap.m.Select({
        width: "180px",
        items: [
          new sap.ui.core.Item({ key: "all", text: "All Statuses" }),
          new sap.ui.core.Item({ key: "pending", text: "Pending" }),
          new sap.ui.core.Item({ key: "approved", text: "Approved" }),
          new sap.ui.core.Item({ key: "rejected", text: "Rejected" })
        ]
      }),
      new sap.m.Label({ text: "Loại" }),
      new sap.m.Select({
        width: "180px",
        items: [
          new sap.ui.core.Item({ key: "all", text: "All Types" }),
          new sap.ui.core.Item({ key: "annual", text: "Nghỉ phép năm" }),
          new sap.ui.core.Item({ key: "sick", text: "Ốm đau" }),
          new sap.ui.core.Item({ key: "maternity", text: "Thai sản" })
        ]
      }),
      new sap.m.ToolbarSpacer(),
      new sap.m.Button({ text: "Lọc", type: "Transparent" }),
      new sap.m.Button({ text: "Tạo mới", type: "Emphasized" })
    ]
  });

  const oCalendarTable = new sap.m.Table({
    inset: false,
    headerText: "Lịch nghỉ team",
    columns: [
      new sap.m.Column({ header: new sap.m.Text({ text: "Ngày" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Nhân viên" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Loại" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Trạng thái" }) })
    ],
    items: {
      path: "/calendar",
      template: new sap.m.ColumnListItem({
        cells: [
          new sap.m.Text({ text: "{date}" }),
          new sap.m.Text({ text: "{employee}" }),
          new sap.m.Text({ text: "{type}" }),
          new sap.m.Text({ text: "{status}" })
        ]
      })
    }
  });

  const oConflictPanel = new sap.m.Panel({
    headerText: "Cảnh báo conflict",
    expandable: false,
    content: [
      new sap.m.Text({ text: "22/05/2026 có 4 người nghỉ, vượt ngưỡng 3 người. Hệ thống cảnh báo để điều phối nhân sự." })
    ]
  });

  const oReportPanel = new sap.m.Panel({
    headerText: "Bảng tổng hợp",
    expandable: false,
    content: [
      new sap.m.FlexBox({
        justifyContent: "SpaceBetween",
        wrap: "Wrap",
        items: [
          new sap.m.ObjectAttribute({ title: "Đã dùng", text: "19 ngày" }),
          new sap.m.ObjectAttribute({ title: "Còn lại", text: "32 ngày" }),
          new sap.m.ObjectAttribute({ title: "Phòng ban", text: "Finance / HR" })
        ]
      })
    ]
  });

  const oReportTable = new sap.m.Table({
    inset: false,
    headerText: "Báo cáo chi tiết",
    columns: [
      new sap.m.Column({ header: new sap.m.Text({ text: "Nhân viên" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Loại phép" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Đã dùng" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Còn lại" }) }),
      new sap.m.Column({ header: new sap.m.Text({ text: "Phòng ban" }) })
    ],
    items: {
      path: "/reports",
      template: new sap.m.ColumnListItem({
        cells: [
          new sap.m.Text({ text: "{employee}" }),
          new sap.m.Text({ text: "{leaveType}" }),
          new sap.m.Text({ text: "{used}" }),
          new sap.m.Text({ text: "{remaining}" }),
          new sap.m.Text({ text: "{department}" })
        ]
      })
    }
  });

  const oTabBar = new sap.m.IconTabBar({
    stretchContentHeight: true,
    items: [
      new sap.m.IconTabFilter({
        text: "Nộp đơn",
        icon: "sap-icon://create",
        content: [
          oRequestPanel,
          oRequestCard
        ]
      }),
      new sap.m.IconTabFilter({
        text: "Phê duyệt",
        icon: "sap-icon://activity-items",
        content: [
          oApprovalFilterBar,
          oApprovalTable
        ]
      }),
      new sap.m.IconTabFilter({
        text: "Lịch team",
        icon: "sap-icon://activity",
        content: [
          oCalendarTable,
          oConflictPanel
        ]
      }),
      new sap.m.IconTabFilter({
        text: "Báo cáo",
        icon: "sap-icon://bar-chart",
        content: [
          oReportPanel,
          oReportTable
        ]
      })
    ]
  });

  const oShellBar = new sap.m.Bar({
    contentLeft: [
      new sap.m.Image({
        src: "https://upload.wikimedia.org/wikipedia/commons/5/59/SAP_2011_logo.svg",
        decorative: false,
        alt: "SAP",
        width: "120px"
      }),
      new sap.m.Button({
        text: "Home",
        icon: "sap-icon://slim-arrow-down",
        iconFirst: false,
        type: "Transparent"
      })
    ],
    contentRight: [
      new sap.m.Button({ icon: "sap-icon://search", type: "Transparent" }),
      new sap.m.Button({ icon: "sap-icon://bell", type: "Transparent" }),
      new sap.m.Avatar({ initials: "D", displaySize: "S" })
    ]
  }).addStyleClass("sapCustomShellBar");

  const oPage = new sap.m.Page({
    customHeader: oShellBar,
    content: [
      new sap.m.FlexBox({
        direction: "Column",
        fitContainer: true,
        items: [
          new sap.m.Panel({
            headerText: "Tổng quan",
            expandable: false,
            content: [
              new sap.m.Text({ text: "Mô phỏng hệ thống quản lý nghỉ phép đúng chuẩn SAP Fiori với các tab chức năng chính." })
            ]
          }),
          oTabBar
        ]
      })
    ]
  });

  const oApp = new sap.m.App({ pages: [oPage] });
  oApp.placeAt("content");
});
