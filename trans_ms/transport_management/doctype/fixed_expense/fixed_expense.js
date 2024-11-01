// Copyright (c) 2021, Aakvatech Limited and contributors
// For license information, please see license.txt

frappe.ui.form.on('Fixed Expense', {
	// refresh: function(frm) {

	// }
	onload: function (frm) {
		frm.set_query("expense_account", function (doc) {
			return {
				filters: [
					["Account", "parent_account", "in", doc.__onload.expense_accounts],
					["Account", "is_group", "=", 0]
				]
			}
		});

		frm.set_query("cash_bank_account", function (doc) {
			return {
				filters: [
					["Account", "parent_account", "in", doc.__onload.cash_bank_accounts],
					["Account", "is_group", "=", 0]
				]
			}
		});
	}
});
