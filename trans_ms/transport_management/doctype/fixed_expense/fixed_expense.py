# Copyright (c) 2021, Aakvatech Limited and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class FixedExpense(Document):
    pass

    def onload(self):
        self.set_onload(
            "expense_accounts",
            frappe.get_all(
                "Transport Expense Account Group",
                fields="account_group",
                pluck="account_group",
                filters={"parent": "Transport Settings"},
            ),
        )

        self.set_onload(
            "cash_bank_accounts",
            frappe.db.get_all(
                "Transport Cash Account Group",
                fields="account_group",
                pluck="account_group",
                filters={"parent": "Transport Settings"},
            ),
        )
