// Copyright (c) 2023, Aakvatech Limited and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Vehicle Tracking Report"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"reqd": 1
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"reqd": 1
		},
		{
			"fieldname": "customer",
			"label": __("Customer"),
			"fieldtype": "Link",
			"options": "Customer",
		},
		{
			"fieldname": "transportation_order",
			"label": __("Transportation Order"),
			"fieldtype": "Link",
			"options": "Transportation Order",
		},
		{
			"fieldname": "vehicle",
			"label": __("Vehicle"),
			"fieldtype": "Link",
			"options": "Vehicle",
		},
		{
			"fieldname": "driver",
			"label": __("Driver"),
			"fieldtype": "Link",
			"options": "Driver",
		},
		{
			"fieldname": "transporter_type",
			"label": __("Transporter Type"),
			"fieldtype": "Select",
			"options": "\nIn House\nSub- Contractor",
		},
		{
			"fieldname": "main_route",
			"label": __("Main Route"),
			"fieldtype": "Link",
			"options": "Trip Route",
		}
	]
};
