// Copyright (c) 2021, Aakvatech Limited and contributors
// For license information, please see license.txt

frappe.ui.form.on('Transportation Order', {
	onload: function (frm) {
		// frm.get_field("assign_transport").grid.cannot_add_rows = true;
		// $("*[data-fieldname='assign_transport']").find(".grid-remove-rows").hide();
		// $("*[data-fieldname='assign_transport']").find(".grid-remove-all-rows").hide();
		//Load the buttons
		var html = '<button style="background-color: green; color: #FFF;" class="btn btn-default btn-xs" onclick="cur_frm.cscript.assign_transport(\'' + frm + '\');">Assign Vehicles</button> ';
		$(frm.fields_dict.html1.wrapper).html(html);

		frm.set_query("cargo_location_city", "cargo", function (doc, cdt, cdn) {
			const row = frappe.get_doc(cdt, cdn);
			console.log(row, cdt, cdn);
			return {
				filters: {
					country: row.cargo_location_country,
				}
			};
		});

		frm.set_query("cargo_destination_city", "cargo", function (doc, cdt, cdn) {
			const row = frappe.get_doc(cdt, cdn);
			console.log(row, cdt, cdn);
			return {
				filters: {
					country: row.cargo_destination_country,
				}
			};
		});
	},

	refresh: function (frm, cdt, cdn) {
		// frm.get_field("assign_transport").grid.cannot_add_rows = true;
		// $("*[data-fieldname='assign_transport']").find(".grid-remove-rows").hide();
		// $("*[data-fieldname='assign_transport']").find(".grid-remove-all-rows").hide();
		//	console.log(frm);
		
		//Fix assignement details
		frm.events.check_assignment_table(frm);

		//If request is from module, disable save, else enable save
		//If the request is from other module, load data from that module
		if (frm.doc.reference_docname) {
			cur_frm.cscript.populate_child(frm.doc.reference_doctype, frm.doc.reference_docname);
			frm.page.clear_indicator();
		}
		frm.events.calculate_total_assigned(frm);
		//frm.events.hide_show_cargo(frm);
		frappe.db.get_single_value('Transport Settings', 'sales_item_group')
			.then(sales_item_group => {
				frm.set_query('item', 'assign_transport', () => {
					return {
						filters: {
							item_group: sales_item_group
						}
					};
				});
			});

		var total_assigned = 0;
		cur_frm.doc.assign_transport.forEach(function(row){			
			total_assigned += row.net_weight;
		});
		if(total_assigned > 0){
			cur_frm.get_field("total_assigned_weight").wrapper.innerHTML = '<p class="text-muted small">Total Assigned Weight</p><b> ' + total_assigned.toLocaleString() +  ' Tonnes<br><br></b>'; 
		}
		frm.events.calculate_net_weight(frm);


	},
	custom_total_weight: function(frm){
		frm.events.calculate_net_weight(frm);
	},

	customer: function(frm){
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: "Customer",
				filters: {
					name: frm.doc.customer
				},
				fieldname: ["default_currency"]
			},
			callback: function (data) {
				if(data.message.default_currency){
					frm.set_value('currency', data.message.default_currency);
				}
			}
		});

		frm.doc.assign_transport.forEach(function (row) {
				frappe.model.set_value('Transport Assignment', row.name, 'customer', frm.doc.customer);
			
		});
		frm.refresh_field('assign_transport');
	},

	currency: function (frm) {
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: "Currency Exchange",
				filters: {
					from_currency: frm.doc.currency
				},
				fieldname: ["exchange_rate"]
			},
			callback: function (data) {
				if(data.message.exchange_rate){
					frm.set_value('exchange_rate', data.message.exchange_rate);
					frm.events.set_items_rate(frm)

				}else{
					frm.set_value('exchange_rate', 1);
					frm.events.set_items_rate(frm)

				}
			}
		});
	},

	exchange_rate: function (frm) {
		
		frm.events.set_items_rate(frm)
	},


	//Fix for bug which did copy cargo details in cargo.
	check_assignment_table: function (frm) {
		if (frm.doc.cargo_type == 'Container') {
			var to_save = false;
			frm.doc.assign_transport.forEach(function (row) {
				if (!row.cargo || row.cargo.toUpperCase().indexOf('NEW') > -1) {
					//Find the cargo details
					frm.doc.cargo.forEach(function (cargo_row) {
						if (cargo_row.container_number == row.container_number) {
							frappe.model.set_value('Transport Assignment', row.name, 'cargo', cargo_row.name);
						}
					});
					to_save = true;
				}
			});
			if (to_save) {
				frappe.after_ajax(function () {
					frm.save_or_update();
				});
			}
		}
	},

	show_submit_button: function (frm) {
		/*//If request is from module, save has been disabled hence need to save manually
		if(frm.doc.reference_docname)
		{
			//Show the not saved label in indicator
			frm.page.set_indicator('Not Saved', 'orange');

			//Activate the submit button (The label has been changed to save)
			frm.page.set_primary_action(__("Save"), function() {
				//First validate vehicle assign table
				if(frm.events.validate_assignment(frm))
				{
					cur_frm.doc.assign_transport.forEach(function(row){
						frappe.call({
							method: "fleet_management.fleet_management.doctype.transport_request.transport_request.assign_vehicle",
							freeze: true,
							args: {
								reference_doctype: cur_frm.doc.reference_doctype,
								reference_docname: cur_frm.doc.reference_docname,
								cargo_docname: row.cargo,
								//cargo_idx: locals['Cargo Details'][row.cargo].idx,
								assigned_vehicle: row.assigned_vehicle,
								assigned_trailer: row.assigned_trailer,
								assigned_driver: row.assigned_driver,
								assigned_idx: row.idx,
								amount: row.amount,
								expected_loading_date: row.expected_loading_date,
								container_number: row.container_number,
								units: row.units,
								transporter_type: row.transporter_type,
								sub_contractor: row.sub_contractor,
								vehicle_plate_number: row.vehicle_plate_number,
								trailer_plate_number: row.trailer_plate_number,
								driver_name: row.driver_name,
								passport_number: row.passport_number,
								route: row.route,
							},
							callback: function(data){
								console.log(data.message);
							}
						});
					});
					cur_frm.page.clear_indicator();
				}
				else
				{
					//If not all data has been entered
					msgprint("Please fill all required fields in assigned vehicle table", "Error");
				}
			});
		}*/
	},

	show_hide_assignment: function (frm, cdt, cdn) {
		//Processed row
		var row = frm.fields_dict['assign_transport'].grid.grid_rows_by_docname[cdn];

		// //Show/hide container specific information
		// if (frm.doc.cargo_type == 'Container') {
		// 	row.toggle_display('cargo', false);
		// 	row.toggle_display('container_number', true);
		// 	row.toggle_display('amount', false);
		// 	row.toggle_display('units', false);
		// }
		// else {
		// 	row.toggle_display('cargo', false);
		// 	row.toggle_display('container_number', false);
		// 	row.toggle_display('amount', true);
		// 	row.toggle_display('units', true);
		// }

		//Make editable according to request origin
		if (frm.doc.reference_docname) {
			row.toggle_editable('cargo', false);
			row.toggle_editable('container_number', false);
			row.toggle_editable('expected_loading_date', false);

		}

		//Hide the extra info section
		row.toggle_display('section_extra', false);

		//Show, hide and enable entries according to the transporter type
		if (locals[cdt][cdn].transporter_type == "Sub-Contractor" || locals[cdt][cdn].transporter_type == "Self Drive") {
			//Show the sub-contractor select box
			row.toggle_display("sub_contractor", (locals[cdt][cdn].transporter_type == "Sub-Contractor"));
			//Enter vehicle details
			row.toggle_display("assigned_vehicle", false);
			row.toggle_editable("vehicle_plate_number", true);
			//Vehicle Documents
			//row.toggle_display("section_vehicle_attachments", true);
			for (var i = 1; i < 5; i++) {
				row.toggle_editable("attach_" + i, true);
				row.toggle_editable("description_" + i, true);
			}
			//Trailor Details
			row.toggle_display("assigned_trailer", false);
			row.toggle_editable("trailer_plate_number", (locals[cdt][cdn].transporter_type == "Sub-Contractor"));
			//Driver Details
			row.toggle_display("assigned_driver", false);
			row.toggle_editable("driver_name", true);
			row.toggle_editable("passport_number", true);
			row.toggle_editable("driver_licence", true);
			row.toggle_editable("driver_contact", true);
		}
		else if (locals[cdt][cdn].transporter_type == "Bravo") {
			//Hide the sub-contractor select box
			row.toggle_display("sub_contractor", false);
			//Enter vehicle details
			row.toggle_display("assigned_vehicle", true);
			row.toggle_editable("assigned_vehicle", true);
			row.toggle_editable("vehicle_plate_number", false);
			//Vehicle Documents
			//row.toggle_display("section_vehicle_attachments", true);
			for (var i = 1; i < 5; i++) {
				row.toggle_editable("attach_" + i, false);
				row.toggle_editable("description_" + i, false);
			}
			//Trailor Details
			row.toggle_display("assigned_trailer", true);
			row.toggle_editable("assigned_trailer", true);
			row.toggle_editable("trailer_plate_number", false);
			//Driver Details
			row.toggle_display("assigned_driver", true);
			row.toggle_editable("assigned_driver", true);
			row.toggle_editable("driver_name", false);
			row.toggle_editable("passport_number", false);
			row.toggle_editable("driver_licence", true);
			row.toggle_editable("driver_contact", true);
		}
		else {
			//Hide the sub-contractor select box
			row.toggle_display("sub_contractor", false);
			//Enter vehicle details
			row.toggle_display("assigned_vehicle", true);
			row.toggle_editable("assigned_vehicle", true);
			row.toggle_editable("vehicle_plate_number", false);
			//Vehicle Documents
			for (var i = 1; i < 5; i++) {
				row.toggle_editable("attach_" + i, false);
				row.toggle_editable("description_" + i, false);
			}
			//Trailor Details
			row.toggle_display("assigned_trailer", true);
			row.toggle_editable("assigned_trailer", true);
			//Driver Details
			row.toggle_display("assigned_driver", true);
			row.toggle_editable("assigned_driver", true);
		}
	},

	// cargo_type: function (frm) {
	// 	frm.events.hide_show_cargo(frm);
	// },

	// hide_show_cargo: function (frm) {
	// 	if (frm.doc.cargo_type == "") {
	// 		frm.toggle_display('cargo', false);
	// 		frm.toggle_display('amount', false);
	// 		frm.toggle_display('unit', false);
	// 		frm.toggle_display('number_of_vehicles', false);
	// 		frm.toggle_display('html1', false);
	// 		frm.toggle_display('goods_description', false);
	// 		frm.toggle_display('cargo_description', false);
	// 		frm.toggle_display('section_vehicle_assignment', false);
	// 	}
	// 	else if (frm.doc.cargo_type == "Container") {
	// 		frm.toggle_display('cargo', true);
	// 		frm.toggle_display('amount', false);
	// 		frm.toggle_display('unit', false);
	// 		frm.toggle_display('number_of_vehicles', false);
	// 		frm.toggle_display('html1', true);
	// 		frm.toggle_display('goods_description', true);
	// 		frm.toggle_display('cargo_description', true);
	// 		frm.toggle_display('section_vehicle_assignment', true);
	// 	}
	// 	else {
	// 		frm.toggle_display('cargo', false);
	// 		frm.toggle_display('amount', true);
	// 		frm.toggle_display('unit', true);
	// 		frm.toggle_display('number_of_vehicles', true);
	// 		frm.toggle_display('html1', false);
	// 		frm.toggle_display('goods_description', true);
	// 		frm.toggle_display('cargo_description', true);
	// 		frm.toggle_display('section_vehicle_assignment', true);
	// 	}
	// },

	/* validate: function (frm) {
		if (!frm.events.validate_assignment(frm)) {
			frappe.msgprint("Please enter all required fields in vehicle assignement table.");
			frappe.validated = false;
		}
	},

	validate_assignment: function (frm) {
		var valid = true;
		//Validate that all required entries are entered in vehicle assignment table
		console.log(frm.doc.assign_transport.length);
		frm.doc.assign_transport.forEach(function (row) {
			if (frm.doc.cargo_type == 'Container') {
				if (row.cargo && row.route)  //Check cargo and route entered
				{
					if (row.transporter_type == "Sub-Contractor") {
						if (row.vehicle_plate_number && row.trailer_plate_number && row.driver_name && row.passport_number) {
							//Its all good, go to the next row
						}
						else {
							valid = false;
							return false;
						}
					}
					else {
						if (row.assigned_vehicle && row.assigned_trailer && row.assigned_driver) {
							//Its all good, go to the next row
						}
						else {
							valid = false;
							return false;
						}
					}
				}
				else {
					valid = false;
					return false;
				}
			}
			else {
				if (row.amount > 0 && row.units && row.route)  //Check cargo and route entered
				{
					if (row.transporter_type == "Sub-Contractor") {
						if (row.vehicle_plate_number && row.trailer_plate_number && row.driver_name && row.passport_number) {
							//Its all good, go to the next row
						}
						else {
							valid = false;
							return false;
						}
					}
					else if (row.transporter_type == "Self Drive") {
						if (row.vehicle_plate_number && row.driver_name && row.passport_number) {
							//Its all good, go to the next row
						}
						else {
							valid = false;
							return false;
						}
					}
					else {
						if (row.assigned_vehicle && row.assigned_trailer && row.assigned_driver) {
							//Its all good, go to the next row
						}
						else {
							valid = false;
							return false;
						}
					}
				}
				else {
					valid = false;
					return false;
				}
			}
		});

		//If the process is not interrupted, then all is well and return true
		if (valid == true) {
			return true;
		}
		else {
			return false;
		}
	},
*/
	calculate_total_assigned: function (frm) {
		if (frm.doc.cargo_type == 'Loose Cargo' && frm.doc.assign_transport.length > 0) {
			frm.toggle_display('total_assigned', true);
			var total = 0;
			frm.doc.assign_transport.forEach(function (row) {
				total = total + row.amount;
			});
			frm.set_value('total_assigned', total + ' ' + frm.doc.unit);
		}
		else {
			frm.toggle_display('total_assigned', false);
		}
	},

	calculate_net_weight: function (frm) {
		var total_assigned = 0;
		var total_ass = 0;
		if(frm.doc.custom_total_weight){
			total_ass = frm.doc.custom_total_weight
		}
		if (frm.doc.assign_transport) {
			frm.doc.assign_transport.forEach(function(row){			
				total_assigned += row.net_weight;
			});
		}
		if(total_assigned > 0){
			var table = '<table id="my-table"><thead><tr><th><p class="text-muted small">Total Assigned Weight: </p></th><th>' + total_assigned.toLocaleString() +  ' Tonnes</th></tr> <tr><th><p class="text-muted small">Total Unassigned Weight: </p></th><th>' + (total_ass - total_assigned).toLocaleString() +  ' Tonnes</th></tr></thead></table>'
			// frm.get_field("total_assigned_weight").wrapper.innerHTML = '<p class="text-muted small">Total Assigned Weight</p><b> ' + total_assigned.toLocaleString() +  ' Tonnes<br><br></b>'; 
			frm.get_field("total_assigned_weight").wrapper.innerHTML = table
		}
	},


	set_items_rate: function (frm) {
		frm.doc.assign_transport.forEach(function (row) {
			if(row.rate && frm.doc.exchange_rate){
				var weight = row.net_weight
				var rate_tone = row.rate
				var exchange_rate = frm.doc.exchange_rate
				var total = weight * rate_tone * exchange_rate
				frappe.model.set_value('Transport Assignment', row.name, 'total', total);
			}
		});
		frm.refresh_field('assign_transport');
	},
	create_invoice: (frm) => {
		if (frm.is_dirty()) {
			frappe.throw(__("Plase Save First"));
			return;
		}
		let selected = frm.get_selected().assign_transport;
		if (selected) {
			let rows = frm.doc.assign_transport.filter(i => selected.includes(i.name) && !i.invoice);
			if (rows.length) {
				frappe.call({
					method: "trans_ms.transport_management.doctype.transportation_order.transportation_order.create_sales_invoice",
					args: {
						doc: frm.doc,
						rows: rows
					},
					callback: function (data) {
						frappe.set_route('Form', data.message.doctype, data.message.name);
					}
				});
			} else {
				frappe.msgprint(__("All Rows Invoiced!"));
			}
		} else {
			frappe.msgprint(__("No Rows Selected!"));
		}
	},
});



frappe.ui.form.on("Transport Assignment", {
	form_render: function (frm, cdt, cdn) {
		frm.events.show_hide_assignment(frm, cdt, cdn);
		locals[cdt][cdn].units = frm.doc.unit;
	},

	before_assign_transport_remove: function (frm, cdt, cdn) {
		if (locals[cdt][cdn].status && locals[cdt][cdn].status == "Processed") {
			frappe.throw("You cannot delete a processed assignment");
		}
	},

	before_assign_transport_add: function (frm, cdt, cdn) {
		if (cur_frm.doc.cargo_type == "Container") {
			frappe.throw('Please use the assign vehicle button to assign vehicles.');
		}
	},

	assign_transport_add: function (frm, cdt, cdn) {
		locals[cdt][cdn].customer = frm.doc.customer;
		locals[cdt][cdn].cargo_type = frm.doc.cargo_type;
		locals[cdt][cdn].file_number = frm.doc.file_number;
		//If units are set, copy units to the assignment
		if (frm.doc.unit) {
			locals[cdt][cdn].units = frm.doc.unit;
		}
		frappe.db.get_single_value('Transport Settings', 'transport_item')
			.then(transport_item => {
				locals[cdt][cdn].item = transport_item;
			});
		// }
		// cur_frm.refresh_field("assign_transport");
		
	},

	amount: function (frm, cdt, cdn) {
		frm.events.show_submit_button(frm);
		frm.events.calculate_total_assigned(frm);
	},

	expected_loading_date: function (frm, cdt, cdn) {
		frm.events.show_submit_button(frm);
	},

	transporter_type: function (frm, cdt, cdn) {
		frm.events.show_hide_assignment(frm, cdt, cdn);
	},

	sub_contractor: function (frm, cdt, cdn) {
		frm.events.show_submit_button(frm);
	},


	assigned_vehicle: function (frm, cdt, cdn) {
		//Automatically enter the plate number, trailer and driver
		//For future reference on how to do this the frappe way. FOr some reason I cant get it to work on child table on first value change
		//cur_frm.add_fetch('assigned_vehicle', 'number_plate', 'vehicle_plate_number');
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: "Vehicle",
				filters: {
					name: locals[cdt][cdn].assigned_vehicle
				},
				fieldname: ["license_plate", "trans_ms_driver", "trans_ms_default_trailer", "trans_ms__driver_name"]
			},
			callback: function (data) {
				// set the returned values in cooresponding fields
				frappe.model.set_value(cdt, cdn, 'vehicle_plate_number', data.message.license_plate);
				frappe.model.set_value(cdt, cdn, 'assigned_trailer', data.message.trans_ms_default_trailer);
				frappe.model.set_value(cdt, cdn, 'assigned_driver', data.message.trans_ms_driver);
				frappe.model.set_value(cdt, cdn, 'driver_name', data.message.trans_ms__driver_name);
			}
		});

		//For vehicle documents
		frappe.model.with_doc('Vehicle', locals[cdt][cdn].assigned_vehicle, function () {
			var ref_vehicle = frappe.model.get_doc('Vehicle', locals[cdt][cdn].assigned_vehicle);
			var i = 1;
			ref_vehicle.vehicle_documents.forEach(function (row) {
				//Fill in the attachments and their descriptions.
				frappe.model.set_value(cdt, cdn, 'attach_' + i, row.attachment);
				frappe.model.set_value(cdt, cdn, 'description_' + i, row.description);
				i++;
			});
		});


		frm.events.show_submit_button(frm);
		frappe.after_ajax(function (row) {
			frm.events.show_hide_assignment(frm, cdt, cdn);
		});
	},

	net_weight: function (frm, cdt, cdn) {
		frm.events.calculate_net_weight(frm);
		var total_assigned = 0;
		var total_ass = 0;
		if(frm.doc.custom_total_weight){
			total_ass = frm.doc.custom_total_weight
		}
		if (frm.doc.assign_transport) {
			frm.doc.assign_transport.forEach(function(row){			
				total_assigned += row.net_weight;
			});
		}
		var weight = locals[cdt][cdn].net_weight
		var bal = total_ass - total_assigned;
		if(bal < 0){
			var tot = total_assigned - weight
			frappe.model.set_value(cdt, cdn, 'net_weight', (total_ass - tot));	
		}
	},

	rate: function (frm, cdt, cdn) {
		var weight = locals[cdt][cdn].net_weight
		var rate_tone = locals[cdt][cdn].rate
		var exchange_rate = frm.doc.exchange_rate
		frappe.model.set_value(cdt, cdn, 'total', (weight * rate_tone * exchange_rate));
	},

	vehicle_plate_number: function (frm, cdt, cdn) {
		frm.events.show_submit_button(frm);
	},

	assigned_trailer: function (frm, cdt, cdn) {
		frappe.call({
			method: "frappe.client.get_value",
			args: {
				doctype: "Trailer",
				filters: {
					name: locals[cdt][cdn].assigned_trailer
				},
				fieldname: ["number_plate"]
			},
			callback: function (data) {
				// set the returned values in cooresponding fields
				frappe.model.set_value(cdt, cdn, 'trailer_plate_number', data.message.number_plate);
			}
		});
		frm.events.show_submit_button(frm);
	},

	trailer_plate_number: function (frm, cdt, cdn) {
		frm.events.show_submit_button(frm);
	},

	driver_name: function (frm, cdt, cdn) {
		frm.events.show_submit_button(frm);
	},

	passport_number: function (frm, cdt, cdn) {
		frm.events.show_submit_button(frm);
	},

	route: function (frm, cdt, cdn) {
		frm.events.show_submit_button(frm);
	},

	create_vehicle_trip_record: function (frm, cdt, cdn) {
		const doc = locals[cdt][cdn];
		var customer = frappe.db.get_value('Transportation Order', doc.parent, 'customer')
		if (doc.vehicle_status == 2 || doc.vehicle_status == 4) //If en route on trip and not offloaded
		{
			frappe.msgprint('The assigned vehicle is En Route on another trip and has not offloaded. Please offload the current cargo before starting new trip.', 'Not Allowed');
		}
		else if (doc.vehicle_status == 3) {
			frappe.confirm(
				'The vehicle is En Route on another trip. Set as return cargo? If you select no, a new trip will be created',
				function () {
					frappe.call({
						method: "trans_ms.transport_management.doctype.vehicle_trip.vehicle_trip.create_vehicle_trip",
						args: {
							reference_doctype: "Transport Assignment",
							reference_docname: doc.name,
							vehicle: doc.assigned_vehicle,
							transporter: doc.transporter_type,
							cargo: doc.cargo,
							driver: doc.assigned_driver,
							customer: doc.customer
						},
						callback: function (data) {
							console.log(data);
							//frm.set_value('status', 'Processed');
							//frm.save_or_update();
							frappe.set_route('Form', data.message.doctype, data.message.name);
						}
					});
				}
			);
		}
		else {
			frappe.call({
				method: "trans_ms.transport_management.doctype.vehicle_trip.vehicle_trip.create_vehicle_trip",
				args: {
					reference_doctype: "Transport Assignment",
					reference_docname: doc.name,
					vehicle: doc.assigned_vehicle,
					transporter: doc.transporter_type,
					cargo: doc.cargo,
					driver: doc.assigned_driver,
					customer: doc.customer
				},
				callback: function (data) {
					console.log(data);
					//frm.set_value('status', 'Processed');
					//frm.save_or_update();
					frappe.set_route('Form', data.message.doctype, data.message.name);
				}
			});
		}
	}

});



cur_frm.cscript.assign_transport = function (frm) {
	var selected = cur_frm.get_selected();
	// var def_curr
	if (selected['cargo']) {
		$.each(selected['cargo'], async function (index, cargo_nm) {
			var container_number = locals["Cargo Details"][cargo_nm].container_number;
			var response = await frappe.db.get_value('Customer', cur_frm.doc.customer, 'default_currency');
			var transport_currency = response.message.default_currency;
			var exists = $('[data-fieldname="assign_transport"]:contains("' + container_number + '")');
			console.log(exists);
			if (exists.length > 0) {
				msgprint('Container No. ' + container_number + ' has already been processed.', 'Error');
			}
			else {
				var new_row = cur_frm.add_child("assign_transport");
				new_row.cargo_type = cur_frm.doc.cargo_type;
				new_row.cargo = locals["Cargo Details"][cargo_nm].name;
				new_row.container_number = container_number;
				new_row.net_weight = locals["Cargo Details"][cargo_nm].net_weight;
				new_row.customer = cur_frm.doc.customer;
				frappe.model.set_value(new_row.doctype, new_row.name, "currency", transport_currency);
				new_row.expected_loading_date = cur_frm.doc.loading_date;
				// new_row.file_number = cur_frm.doc.file_number;
				// if (cur_frm.doc.reference_doctype == 'Import') {
				// 	new_row['import'] = cur_frm.doc.reference_docname;
				// }
				// else if (cur_frm.reference_doctype == 'Export') {
				// 	new_row['export'] = cur_frm.doc.reference_docname;
				frappe.db.get_single_value('Transport Settings', 'transport_item')
					.then(transport_item => {
						new_row.item = transport_item;
					});
				// }
				cur_frm.refresh_field("assign_transport");
			}
		});
	}
	else {
		show_alert("Error: Please select cargo to process.");
	}
	//}
};

cur_frm.cscript.populate_child = function (reference_doctype, reference_docname) {
	if (reference_doctype == "Import") {
		frappe.model.with_doc(reference_doctype, reference_docname, function () {
			var request_total_amount = null;
			var reference_doc = frappe.get_doc(reference_doctype, reference_docname);

			//Load data and set as read only
			cur_frm.set_value('request_received', cur_frm.meta.creation.substr(0, 10));
			cur_frm.set_value('customer', reference_doc.customer);
			cur_frm.set_value('consignee', reference_doc.consignee);
			cur_frm.set_value('shipper', reference_doc.shipper);
			cur_frm.set_value('cargo_location_city', reference_doc.port_of_discharge);
			cur_frm.set_value('loading_date', reference_doc.ata);
			cur_frm.set_value('cargo_destination_country', reference_doc.cargo_destination_country);
			cur_frm.set_value('cargo_destination_city', reference_doc.cargo_destination_city);
			cur_frm.set_value('border1_clearing_agent', reference_doc.clearing_agent_border_1);
			cur_frm.set_value('border2_clearing_agent', reference_doc.clearing_agent_border_2);
			cur_frm.set_value('border3_clearing_agent', reference_doc.clearing_agent_border_3);
			cur_frm.set_value('special_instructions_to_transporter', reference_doc.special_instructions_to_transporter);
			cur_frm.set_value('cargo_type', 'Container');
			cur_frm.set_value('goods_description', reference_doc.cargo);
			cur_frm.set_value('cargo_description', reference_doc.cargo_description);
			cur_frm.set_value('file_number', reference_doc.reference_file_number);

			//Set as read only
			cur_frm.toggle_enable(['request_received', 'customer', 'cargo_location_city', 'loading_date', 'cargo_destination_city',
				'cargo_destination_country', 'cargo_type', 'goods_description', 'cargo_description', 'file_number',
				'consignee', 'shipper', 'special_instructions_to_transporter'], 0);
			cur_frm.toggle_enable(['border1_clearing_agent', 'border2_clearing_agent', 'border3_clearing_agent', 'cargo_location_country', 'transport_type', 'cargo'], 0);

			//Get port country
			frappe.model.with_doc('Port', reference_doc.port_of_discharge, function (frm) {
				cur_frm.set_value('cargo_location_country', frappe.model.get_doc('Port', reference_doc.port_of_discharge).country);
			});

			if (reference_doc.import_type == "Local") {
				cur_frm.set_value('transport_type', 'Internal');
			}
			else if (reference_doc.import_type == "Transit") {
				cur_frm.set_value('transport_type', 'Cross Border');
			}
		});
		return "done";
	}

};

frappe.ui.form.on('Cargo Details', {
	onload(frm) {

	},
	refersh(frm) {
		console.info("Table Refresh");
	},
});
