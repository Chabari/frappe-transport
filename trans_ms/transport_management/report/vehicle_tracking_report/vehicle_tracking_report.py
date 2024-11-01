# Copyright (c) 2023, Aakvatech Limited and contributors
# For license information, please see license.txt

import frappe	
from frappe import _


def execute(filters=None):
	data = []
	trips, name_list = get_trip_details(filters)
	if len(trips) == 0:
		frappe.msgprint(_("<b>No data found, Please check your filters</b>"))
		return [], []
	
	trip_steps = get_trip_steps(name_list)
	
	columns = get_columns(filters)
	locations = [{"location": d.location, "type": d.location_type} for d in trip_steps if d.parent == name_list[0]]
	      
	for d in locations:
		columns.append({"fieldname": "arrival_" + frappe.scrub(d.get("location")), "fieldtype": "Date", "label": _("Arrived " + d.get("location")), "width": "100px"})
		columns.append({"fieldname": "departure_" + frappe.scrub(d.get("location")), "fieldtype": "Date", "label": _("Depart " + d.get("location")), "width": "100px"})
	
	for row in trips:
		new_row = {}
		for step in trip_steps:
			if row.name == step.parent:
				arrival_name = "arrival_" + frappe.scrub(step.location)
				departure_name = "departure_" + frappe.scrub(step.location)
				new_row[arrival_name] = step.arrival_date
				new_row[departure_name] = step.departure_date
			
		new_row.update({
			"hose": row.vehicle,
			"trailer": row.trailer,
			"driver_name": row.driver_name,
			"contact_number": row.cell_number,
			"tonage": row.net_weight,
			"position": "",
			"loaded_date": row.start_date,
			"tracking_date": ""
		})
		data.append(new_row)
	
	return columns, data

def get_columns(filters):
	columns = [
		{"fieldname": "hose", "fieldtype": "Data", "label": _("Hose"), "width": "100px"},
		{"fieldname": "trailer", "fieldtype": "Data", "label": _("Trailer"), "width": "100px"},
		{"fieldname": "driver_name", "fieldtype": "Data", "label": _("Driver Name"), "width": "100px"},
		{"fieldname": "contact_number", "fieldtype": "Data", "label": _("Contact Number"), "width": "100px"},
		{"fieldname": "tonage", "fieldtype": "Float", "label": _("Tonage"), "width": "100px"},
		{"fieldname": "position", "fieldtype": "Data", "label": _("Position"), "width": "100px"},
		{"fieldname": "loaded_date", "fieldtype": "Date", "label": _("Loaded Date"), "width": "100px"},
		{"fieldname": "tracking_date", "fieldtype": "Date", "label": _("Tracking_date"), "width": "100px"},
	]
	return columns

def get_trip_details(filters):
	conditions = get_conditions(filters)
	trip_details = frappe.db.sql("""
		SELECT vt.name, vt.vehicle, vt.trailer, vt.customer, 
			vt.driver, vt.driver_name, vt.start_date, d.cell_number, cd.net_weight
		FROM `tabVehicle Trip` vt
		INNER JOIN `tabDriver` d ON vt.driver = d.name
		INNER JOIN `tabTransport Assignment` ta ON vt.name = ta.created_trip
		INNER JOIN `tabCargo Details` cd ON ta.cargo = cd.name
		WHERE vt.docstatus = 1 {conditions}
	""".format(conditions=conditions), filters,as_dict=True)

	trip_names = list(map(lambda x: x.name, trip_details))
	return trip_details, trip_names

def get_trip_steps(trip_names):
	if len(trip_names) == 0:
		return 
	trip_steps = frappe.db.sql("""
		SELECT ts.parent, ts.location, ts.location_type,
			ts.arrival_date, ts.departure_date,
			ts.loading_date, ts.offloading_date
		FROM `tabRoute Steps Table` ts
		WHERE ts.parent IN %(trip_names)s
	""", {'trip_names': trip_names}, as_dict=True)

	return trip_steps

def get_conditions(filters):
	conditions = ""
	if filters.get("from_date"):
		conditions += " AND vt.start_date >= %(from_date)s"
	if filters.get("to_date"):
		conditions += " AND vt.start_date <= %(to_date)s"
	if filters.get("customer"):
		conditions += " AND vt.customer = %(customer)s"
	if filters.get("transportation_order"):
		conditions += " AND vt.transportation_order = %(transportation_order)s"
	if filters.get("vehicle"):
		conditions += " AND vt.vehicle = %(vehicle)s"
	if filters.get("transporter_type"):
		conditions += " AND vt.transporter_type = %(transporter_type)s"
	if filters.get("driver"):
		conditions += " AND vt.driver = %(driver)s"
	if filters.get("main_route"):
		conditions += " AND vt.main_route = %(main_route)s"
	
	return conditions