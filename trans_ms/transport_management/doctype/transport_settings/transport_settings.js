// Copyright (c) 2021, Aakvatech Limited and contributors
// For license information, please see license.txt

frappe.ui.form.on('Transport Settings', {
	// refresh: function(frm) {

	// }
	onload: function (frm) {
		frm.set_query("expense_account_group", function () {
			return {
				"filters": {
					"root_type": "Expense",
					"is_group": 1
				}
			};
		});
		frm.set_query("cash_bank_account_group", function () {
			return {
				"filters": {
					"root_type": "Asset",
					"is_group": 1
				}
			};
		});
	},
});
