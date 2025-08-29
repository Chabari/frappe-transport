# -*- coding: utf-8 -*-
# Copyright (c) 2022, Aakvatech Limited and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe.utils import nowdate


class VehicleInspection(Document):
    def before_insert(self):
        vehicle = frappe.get_doc("Vehicle", self.vehicle_plate_number)
        vehicle.status = "Booked for Inspection"
        vehicle.save(ignore_permissions = True)
        
    def before_submit(self):
        if self.vehicle_status in ["Booked"]:
            frappe.throw("<b>Failed, Vehicle cannot be in status Booked</b>")
        
    def on_submit(self):
        vehicle = frappe.get_doc("Vehicle", self.vehicle_plate_number)
        vehicle.status = self.vehicle_status
        vehicle.save(ignore_permissions = True)
        
    def on_trash(self):
        vehicle = frappe.get_doc("Vehicle", self.vehicle_plate_number)
        vehicle.status = "Available"
        vehicle.save()
        

@frappe.whitelist(allow_guest=True)
def book_inspection(**args):
    vehicle = frappe.get_doc("Vehicle", args.get('name'))
    vehicle_inspection = frappe.db.get_value(
        "Vehicle Inspection", {"vehicle_plate_number": vehicle.name, "docstatus": 0}
    )
    if vehicle_inspection:
        frappe.throw("Failed, Vehicle is already being inspected")
    
    vehicle_inspection = frappe.new_doc("Vehicle Inspection")
    vehicle_inspection.driver_name = vehicle.employee
    vehicle_inspection.vehicle_plate_number = vehicle.license_plate
    vehicle_inspection.trailer_no = vehicle.trans_ms_default_trailer
    vehicle_inspection.date = nowdate()
    vehicle_inspection.vehicle_status = "Booked"
    vehicle_inspection.save(ignore_permissions=True)
    frappe.response.success = True
    frappe.response.data = vehicle_inspection
    return
