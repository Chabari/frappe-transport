# Copyright (c) 2021, Aakvatech Limited and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import json
import frappe
import time
import datetime
from frappe.model.document import Document
from frappe import _, msgprint
from frappe.model.mapper import get_mapped_doc
from frappe.utils import nowdate
from trans_ms.utlis.dimension import set_dimension


class FuelRequest(Document):
    def onload(self):
        trip = frappe.get_doc(self.reference_doctype, self.reference_docname)
        # Load approved fuel for main trip
        if trip.main_route and trip.vehicle:
            consumption = frappe.db.get_value(
                "Vehicle", trip.vehicle, "trans_ms_fuel_consumption"
            )
            route = frappe.db.get_value("Trip Route", trip.main_route, "total_distance")
            approved_fuel = consumption * route
            self.set("main_route", trip.main_route)
            self.set("main_approved_fuel", str(approved_fuel) + " Litres")

        # Load approved fuel for return trip
        # if trip.return_route and trip.vehicle:
        #     consumption = frappe.db.get_value(
        #         "Vehicle", trip.vehicle, "trans_ms_fuel_consumption"
        #     )
        #     route = frappe.db.get_value(
        #         "Trip Route", trip.return_route, "total_distance"
        #     )
        #     approved_fuel = consumption * route
        #     self.set("return_route", trip.return_route)
        #     self.set("return_approved_fuel", str(approved_fuel) + " Litres")

    def get_all_children(self, parenttype=None):
        # For getting children
        return []

    def update_children(self):
        """update child tables"""

    def before_save(self):
        for row in self.approved_requests:
            doc = frappe.get_doc("Fuel Request Table", row.name)
            doc.db_set("disburcement_type", row.disburcement_type)
            doc.db_set("supplier", row.supplier)
            doc.db_set("receipt_date", row.receipt_date)
            doc.db_set("receipt_time", row.receipt_time)
            doc.db_set("received_by", row.received_by)

    def load_from_db(self):
        """Load document and children from database and create properties
        from fields"""
        if not getattr(self, "_metaclass", False) and self.meta.issingle:
            single_doc = frappe.db.get_singles_dict(self.doctype)
            if not single_doc:
                single_doc = frappe.new_doc(self.doctype).as_dict()
                single_doc["name"] = self.doctype
                del single_doc["__islocal"]

            super(Document, self).__init__(single_doc)
            self.init_valid_columns()
            self._fix_numeric_types()

        else:
            d = frappe.db.get_value(self.doctype, self.name, "*", as_dict=1)
            if not d:
                frappe.throw(
                    _("{0} {1} not found").format(_(self.doctype), self.name),
                    frappe.DoesNotExistError,
                )

            super(Document, self).__init__(d)

        if self.name == "DocType" and self.doctype == "DocType":
            from frappe.model.meta import doctype_table_fields

            table_fields = doctype_table_fields
        else:
            table_fields = self.meta.get_table_fields()

        for df in table_fields:
            if df.fieldname == "approved_requests":
                # Load approved or rejected requests
                children_main_approved = frappe.db.get_values(
                    df.options,
                    {
                        "parent": self.get("reference_docname"),
                        "parenttype": self.get("reference_doctype"),
                        "parentfield": "main_fuel_request",
                        "status": "Approved",
                    },
                    "*",
                    as_dict=True,
                    order_by="idx asc",
                )
                children_main_rejected = frappe.db.get_values(
                    df.options,
                    {
                        "parent": self.get("reference_docname"),
                        "parenttype": self.get("reference_doctype"),
                        "parentfield": "main_fuel_request",
                        "status": "Rejected",
                    },
                    "*",
                    as_dict=True,
                    order_by="idx asc",
                )
                children_return_approved = frappe.db.get_values(
                    df.options,
                    {
                        "parent": self.get("reference_docname"),
                        "parenttype": self.get("reference_doctype"),
                        "parentfield": "return_fuel_request",
                        "status": "Approved",
                    },
                    "*",
                    as_dict=True,
                    order_by="idx asc",
                )
                children_return_rejected = frappe.db.get_values(
                    df.options,
                    {
                        "parent": self.get("reference_docname"),
                        "parenttype": self.get("reference_doctype"),
                        "parentfield": "return_fuel_request",
                        "status": "Rejected",
                    },
                    "*",
                    as_dict=True,
                    order_by="idx asc",
                )
                children = (
                    children_main_approved
                    + children_main_rejected
                    + children_return_approved
                    + children_return_rejected
                )
                if children:
                    self.set(df.fieldname, children)
                else:
                    self.set(df.fieldname, [])
            elif df.fieldname == "requested_fuel":
                # Load requests which are not approved nor rejected
                children_main_requested = frappe.db.get_values(
                    df.options,
                    {
                        "parent": self.get("reference_docname"),
                        "parenttype": self.get("reference_doctype"),
                        "parentfield": "main_fuel_request",
                        "status": "Requested",
                    },
                    "*",
                    as_dict=True,
                    order_by="idx asc",
                )
                children_return_requested = frappe.db.get_values(
                    df.options,
                    {
                        "parent": self.get("reference_docname"),
                        "parenttype": self.get("reference_doctype"),
                        "parentfield": "return_fuel_request",
                        "status": "Requested",
                    },
                    "*",
                    as_dict=True,
                    order_by="idx asc",
                )
                children = children_main_requested + children_return_requested
                if children:
                    self.set(df.fieldname, children)
                else:
                    self.set(df.fieldname, [])

        # sometimes __setup__ can depend on child values, hence calling again at the end
        if hasattr(self, "__setup__"):
            self.__setup__()


def set_status(doc):
    parent_doc_name = frappe.db.get_value("Fuel Request Table", doc, "parent")
    fuel_requests = frappe.db.sql(
        """SELECT name, status FROM `tabFuel Request Table` WHERE parent = %(parent_name)s""",
        {"parent_name": parent_doc_name},
        as_dict=1,
    )

    processed_requests = 0
    status = "Fully Processed"

    for request in fuel_requests:
        if request.status not in ["Approved", "Rejected"]:
            status = "Partially Processed"
        else:
            processed_requests = processed_requests + 1

    parent_request_name = frappe.db.get_value(
        "Fuel Request", {"reference_docname": parent_doc_name}
    )
    parent_request_doc = frappe.get_doc("Fuel Request", parent_request_name)
    if 0 == processed_requests:
        parent_request_doc.db_set("status", "Waiting Approval")
    else:
        parent_request_doc.db_set("status", status)

# .
@frappe.whitelist(allow_guest=True)
def approve_request(**args):
    try:
        args = frappe._dict(args)
        allitems = json.loads(args.get('items'))

        # Timestamp
        ts = time.time()
        timestamp = datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
        
        processed = 0
        total = len(allitems)
        jv_doc = None
        for itm in allitems:
            itm = frappe._dict(itm)
            doc = frappe.get_doc("Fuel Request Table", itm.request_docname)
            jv_doc = create_fuel_jounal(doc)
            if jv_doc:
                doc.db_set("status", "Approved")
                doc.db_set("approved_by", itm.user)
                doc.db_set("approved_date", timestamp)
                set_status(itm.request_docname)
                processed += 1
        
        if total > processed:
            frappe.response.message = f"Failed. Processed {str(processed)} out of {str(total)}"
            frappe.response.success = False
            return
                
        frappe.response.success = True
        frappe.response.data = jv_doc
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), str(e))
        frappe.response.message = str(e)
        frappe.response.success = False

@frappe.whitelist()
def create_fuel_jounal(doc):
    parent_request_name = frappe.db.get_value(
        "Fuel Request", {"reference_docname": doc.parent}
    )
    parent_request_doc = frappe.get_doc("Fuel Request", parent_request_name)
    vehicle = frappe.get_doc("Vehicle", parent_request_doc.vehicle)
    if vehicle.custom_default_fuel_expense_account:
        company_abbr = frappe.db.get_value(
            "Company",
            parent_request_doc.company,
            "abbr",
        )
        
        if doc.journal_entry:
            frappe.throw("Journal Entry Already Created")

        # if doc.status != "Approved":
        #     frappe.throw("Fund Request is not Approved")

        accounts = []
        
        multi_currency = 0
        debit_exchange_rate = 1
        debit_amount = doc.total_cost
        credit_exchange_rate = 1
        credit_amt = doc.total_cost

        default_payable_account = frappe.get_value("Transport Settings", None, "default_payable_account")

        debit_row = dict(
            account=vehicle.custom_default_fuel_expense_account,
            exchange_rate=debit_exchange_rate,
            cost_center=vehicle.name + " - " + company_abbr,
            debit_in_account_currency=debit_amount,
        )
        accounts.append(debit_row)

        credit_row = dict(
            account=default_payable_account,
            exchange_rate=credit_exchange_rate,
            cost_center=vehicle.name + " - " + company_abbr,
            credit_in_account_currency=credit_amt,
        )
        accounts.append(credit_row)

        company = parent_request_doc.company
        user_remark = "Fuel for Vehicle Trip No: {0} for Vehicle Reg {1}".format(parent_request_doc.reference_docname, vehicle.name)
        date = nowdate()
        jv_doc = frappe.get_doc(
            dict(
                doctype="Journal Entry",
                posting_date=date,
                accounts=accounts,
                company=company,
                multi_currency=multi_currency,
                user_remark=user_remark,
            )
        )
        
        jv_doc.flags.ignore_permissions = True
        frappe.flags.ignore_account_permission = True
        set_dimension(doc, jv_doc)
        for account_row in jv_doc.accounts:
            set_dimension(doc, jv_doc, tr_child=account_row)
        jv_doc.save()
        jv_doc.submit()
        jv_url = frappe.utils.get_url_to_form(jv_doc.doctype, jv_doc.name)
        si_msgprint = "Journal Entry Created <a href='{0}'>{1}</a>".format(
            jv_url, jv_doc.name
        )
        frappe.set_value("Fuel Request Table", doc.name, "journal_entry", jv_doc.name)
        return jv_doc



@frappe.whitelist(allow_guest=True)
def reject_request(**args):
    try:
        args = frappe._dict(args)
        allitems = json.loads(args.get('items'))

        # Timestamp
        ts = time.time()
        timestamp = datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
        
        processed = 0
        total = len(allitems)
        for itm in allitems:
            itm = frappe._dict(itm)
            doc = frappe.get_doc("Fuel Request Table", itm.request_docname)
            doc.db_set("status", "Approved")
            doc.db_set("approved_by", itm.user)
            doc.db_set("approved_date", timestamp)
            set_status(itm.request_docname)
            processed += 1
        
        if total > processed:
            frappe.response.message = f"Failed. Processed {str(processed)} out of {str(total)}"
            frappe.response.success = False
            return
                
        frappe.response.success = True
        frappe.response.message = "Success. Fuel requests have been processed."
    
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), str(e))
        frappe.response.message = str(e)
        frappe.response.success = False
        
# @frappe.whitelist()
# def make_purchase_order(source_name, target_doc=None):

# 	doc = get_mapped_doc("Fuel Request", source_name,	{
# 		"Fuel Request": {
# 			"doctype": "Purchase Order",
# 			"field_map": {

# 			},
# 			"validation": {
# 				"docstatus": ["=", 0],
# 			}
# 		},
# 		"Fuel Request Table": {
# 			"doctype": "Purchase Order Item",
# 			"field_map": {
#                 "name": "fuel_request_table",
# 				"parent":"fuel_request",
#                 "item_code":"item_code",
# 				#"total_cost":"amount",
# 				"quantity": "qty",
# 				#"cost_per_litre": "rate",
# 				source_name:"fuel_request"
# 			},

# 		},
# 	}, target_doc)

# return doc


@frappe.whitelist()
def create_purchase_order(request_doc, item):
    # frappe.throw(request_doc)
    item = frappe._dict(json.loads(item))
    request_doc = frappe._dict(json.loads(request_doc))
    set_warehouse = frappe.get_value(
        "Vehicle", request_doc.vehicle_plate_number, "trans_ms_fuel_warehouse"
    )
    if not set_warehouse:
        frappe.throw(_("Fuel Stock Warehouse not set in Vehicle"))
    if item.purchase_order:
        frappe.throw(_("Purchase Order is already exists"))
    doc = frappe.new_doc("Purchase Order")
    doc.company = request_doc.company
    doc.department = item.supplier
    doc.supplier = item.supplier
    doc.schedule_date = nowdate()
    doc.docstatus = 1
    doc.set_warehouse = set_warehouse
    new_item = doc.append("items", {})
    new_item.item_code = item.item_code
    new_item.qty = item.quantity
    new_item.rate = item.cost_per_litre
    new_item.source_name = "fuel_request"
    set_dimension(request_doc, doc)
    set_dimension(request_doc, doc, tr_child=new_item)
    doc.insert(ignore_permissions=True)
    frappe.msgprint(_("Purchase Order {0} is created").format(doc.name))
    frappe.set_value(item.doctype, item.name, "purchase_order", doc.name)
    return doc.name


@frappe.whitelist()
def make_stock_entry(source_name, target_doc=None):
    doc = get_mapped_doc(
        "Fuel Request",
        source_name,
        {
            "Fuel Request": {
                "doctype": "Stock Entry",
                "field_map": {},
                "validation": {
                    "docstatus": ["=", 0],
                },
            },
            "Fuel Request Table": {
                "doctype": "Stock Entry Detail",
                "field_map": {
                    "name": "fuel_request_table",
                    "parent": "fuel_request",
                    # "total_cost": "basic_amount",
                    "quantity": "qty",
                    source_name: "fuel_request",
                    # "cost_per_litre": "basic_rate",
                },
            },
        },
        target_doc,
    )
    return doc
