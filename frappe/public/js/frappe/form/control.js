// Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
// MIT License. See license.txt

frappe.ui.form.make_control = function(opts) {
	var control_class_name = "Control" + opts.df.fieldtype.replace(/ /g, "");
	if(frappe.ui.form[control_class_name]) {
		return new frappe.ui.form[control_class_name](opts);
	} else {
		console.log("Invalid Control Name: " + opts.df.fieldtype);
	}
}

// old style
function make_field(docfield, doctype, parent, frm, in_grid, hide_label) { // Factory
	return frappe.ui.form.make_control({
		df: docfield,
		doctype: doctype,
		parent: parent,
		hide_label: hide_label,
		frm: frm
	});
}

frappe.ui.form.Control = Class.extend({
	init: function(opts) {
		$.extend(this, opts);
		this.make();

		// if developer_mode=1, show fieldname as tooltip
		if(frappe.boot.profile && frappe.boot.profile.name==="Administrator" &&
			frappe.boot.developer_mode===1 && this.$wrapper) {
				this.$wrapper.attr("title", frappe._(this.df.fieldname));
		}
	},
	make: function() {
		this.make_wrapper();
		this.wrapper = this.$wrapper.get(0);
		this.wrapper.fieldobj = this; // reference for event handlers
	},
	
	make_wrapper: function() {
		this.$wrapper = $("<div>").appendTo(this.parent);
	},
	
	// returns "Read", "Write" or "None" 
	// as strings based on permissions
	get_status: function(explain) {
		if(!this.doctype)
			return "Write";
		return frappe.perm.get_field_display_status(this.df, 
			locals[this.doctype][this.docname], this.perm || this.frm.perm, explain);
	},
	refresh: function() {
		this.disp_status = this.get_status();
		this.$wrapper 
			&& this.$wrapper.toggle(this.disp_status!="None")
			&& this.$wrapper.trigger("refresh");
	},
	get_doc: function() {
		return this.doctype && this.docname 
			&& locals[this.doctype] && locals[this.doctype][this.docname] || {};
	},
	parse_validate_and_set_in_model: function(value) {
		var me = this;
		this.inside_change_event = true;
		if(this.parse) value = this.parse(value);

		var set = function(value) {
			me.set_model_value(value); 
			me.inside_change_event = false;
			me.set_mandatory && me.set_mandatory(value);
		}

		this.validate ? this.validate(value, set) : set(value);
	},
	get_parsed_value: function() {
		var me = this;
		return this.get_value ? 
			(this.parse ? this.parse(this.get_value()) : this.get_value()) : 
			undefined;
	},
	set_model_value: function(value) {
		if(frappe.model.set_value(this.doctype, this.docname, this.df.fieldname, 
			value, this.df.fieldtype)) {
			this.last_value = value;
		}
	},
});

frappe.ui.form.ControlHTML = frappe.ui.form.Control.extend({
	make: function() {
		this._super();
		var me = this;
		this.disp_area = this.wrapper;
		this.$wrapper.on("refresh", function() {
			if(me.df.options)
				me.$wrapper.html(me.df.options);
		})
	}
});

frappe.ui.form.ControlImage = frappe.ui.form.Control.extend({
	make: function() {
		this._super();
		var me = this;
		this.$wrapper
			.css({"margin-bottom": "10px", "margin-right": "15px", "float": "right", 
				"text-align": "right", "max-width": "100%"})
			.on("refresh", function() {
				me.$wrapper.empty();
				if(me.df.options && me.frm.doc[me.df.options]) {
					$("<img src='"+me.frm.doc[me.df.options]+"' style='max-width: 70%;'>")
						.appendTo(me.$wrapper);
				} else {
					$("<div class='missing-image'><i class='icon-camera'></i></div>")
						.appendTo(me.$wrapper)
				}
				return false;
			});
	}
});

frappe.ui.form.ControlInput = frappe.ui.form.Control.extend({
	horizontal: true,
	make: function() {
		// parent element
		this._super();
		this.set_input_areas();
		
		// set description
		this.set_max_width();
		this.setup_update_on_refresh();
	},
	make_wrapper: function() {
		if(this.only_input) {
			this.$wrapper = $('<div class="form-group">').appendTo(this.parent);
		} else {
			this.$wrapper = $('<div class="form-horizontal">\
				<div class="form-group row" style="margin: 0px">\
					<label class="control-label small col-xs-'+(this.horizontal?"4":"12")
						+'" style="padding-right: 0px;"></label>\
					<div class="col-xs-'+(this.horizontal?"8":"12")+'">\
						<div class="control-input"></div>\
						<div class="control-value like-disabled-input" style="display: none;"></div>\
						<p class="help-box small text-muted"></p>\
					</div>\
				</div>\
			</div>').appendTo(this.parent);
			if(!this.horizontal) {
				this.$wrapper.removeClass("form-horizontal");
			}
		}
	},
	set_input_areas: function() {
		if(this.only_input) {
			this.input_area = this.wrapper;
		} else {
			this.label_area = this.label_span = this.$wrapper.find("label").get(0);
			this.input_area = this.$wrapper.find(".control-input").get(0);
			// keep a separate display area to rendered formatted values
			// like links, currencies, HTMLs etc.
			this.disp_area = this.$wrapper.find(".control-value").get(0);
		}
	},
	set_max_width: function() {
		if(this.horizontal) {
			this.$wrapper.css({"max-width": "600px"});
		}
	},
	
	// update input value, label, description
	// display (show/hide/read-only),
	// mandatory style on refresh
	setup_update_on_refresh: function() {
		var me = this;
		this.$wrapper.on("refresh", function() {
			if(me.disp_status != "None") {
				// refresh value
				if(me.doctype && me.docname) {
					me.value = frappe.model.get_value(me.doctype, me.docname, me.df.fieldname);
				}
				
				if(me.disp_status=="Write") {
					me.disp_area && $(me.disp_area).toggle(false);
					$(me.input_area).toggle(true);
					$(me.input_area).find("input").prop("disabled", false);
					!me.has_input && me.make_input();
					if(me.doctype && me.docname)
						me.set_input(me.value);
				} else {
					$(me.input_area).toggle(false);
					$(me.input_area).find("input").prop("disabled", true);
					me.disp_area && $(me.disp_area)
						.toggle(true)
						.html(
							frappe.format(me.value, me.df, {no_icon:true}, locals[me.doctype][me.name])
						);
				}
				
				me.set_description();
				me.set_label();
				me.set_mandatory(me.value);
			}
			return false;
		});
	},
	bind_change_event: function() {
		var me = this;
		this.$input && this.$input.on("change", this.change || function(e) { 
			if(me.doctype && me.docname && me.get_value) {
				me.parse_validate_and_set_in_model(me.get_value());
			} else {
				// inline
				var value = me.get_value();
				if(me.parse) {
					value = me.parse(value);
				}
				if(me.validate) {
					me.validate(value, function(value1) { 
						if(value !== value1)
							me.set_input(value1) 
					});
				}
			}
		});
	},
	set_label: function(label) {
		if(label) this.df.label = label;
		
		if(this.only_input || this.df.label==this._label) 
			return;
		
		// var icon = frappe.ui.form.fieldtype_icons[this.df.fieldtype];
		// if(this.df.fieldtype==="Link") {
		// 	icon = frappe.boot.doctype_icons[this.df.options];
		// } else if(this.df.link_doctype) {
		// 	icon = frappe.boot.doctype_icons[this.df.link_doctype];
		// }
		var icon = "";
		this.label_span.innerHTML = (icon ? '<i class="'+icon+'"></i> ' : "") + 
			frappe._(this.df.label)  || "&nbsp;";
		this._label = this.df.label;
	},
	set_description: function() {
		if(this.only_input || this.df.description===this._description) 
			return;
		if(this.df.description) {
			this.$wrapper.find(".help-box").html(frappe._(this.df.description));
		} else {
			this.set_empty_description();
		}
		this._description = this.df.description;
	},
	set_empty_description: function() {
		this.$wrapper.find(".help-box").html("");		
	},
	set_mandatory: function(value) {
		this.$wrapper.toggleClass("has-error", (this.df.reqd 
			&& (value==null || value==="")) ? true : false);
	},
});

frappe.ui.form.ControlData = frappe.ui.form.ControlInput.extend({
	html_element: "input",
	input_type: "text",
	make_input: function() {
		this.$input = $("<"+ this.html_element +">")
			.attr("type", this.input_type)
			.addClass("input-with-feedback form-control")
			.prependTo(this.input_area)
		
		this.set_input_attributes();
		this.input = this.$input.get(0);
		this.has_input = true;
		this.bind_change_event();
	},
	set_input_attributes: function() {
		this.$input
			.attr("data-fieldtype", this.df.fieldtype)
			.attr("data-fieldname", this.df.fieldname)
			.attr("placeholder", this.df.placeholder || "")
		if(this.doctype)
			this.$input.attr("data-doctype", this.doctype);
		if(this.df.input_css)
			this.$input.css(this.df.input_css);
	},
	set_input: function(val) {
		this.$input.val(this.format_for_input(val));
		this.last_value = val;
		this.set_mandatory && this.set_mandatory(val);
	},
	get_value: function() {
		return this.$input ? this.$input.val() : undefined;
	},
	format_for_input: function(val) {
		return val==null ? "" : val;
	},
	validate: function(v, callback) {
		if(this.df.options == 'Phone') {
			if(v+''=='')return '';
			v1 = ''
			// phone may start with + and must only have numbers later, '-' and ' ' are stripped
			v = v.replace(/ /g, '').replace(/-/g, '').replace(/\(/g, '').replace(/\)/g, '');

			// allow initial +,0,00
			if(v && v.substr(0,1)=='+') {
				v1 = '+'; v = v.substr(1);
			}
			if(v && v.substr(0,2)=='00') {
				v1 += '00'; v = v.substr(2);
			} 
			if(v && v.substr(0,1)=='0') {
				v1 += '0'; v = v.substr(1);
			}
			v1 += cint(v) + '';
			callback(v1);
		} else if(this.df.options == 'Email') {
			if(v+''=='')return '';
			if(!validate_email(v)) {
				msgprint(frappe._("Invalid Email") + ": " +  v);
					callback("");
			} else
				callback(v);
		} else {
			callback(v);
		}
	}
});

frappe.ui.form.ControlReadOnly = frappe.ui.form.ControlData.extend({
	get_status: function(explain) {
		var status = this._super(explain);
		if(status==="Write") 
			status = "Read";
		return;
	}
});


frappe.ui.form.ControlPassword = frappe.ui.form.ControlData.extend({
	input_type: "password"
});

frappe.ui.form.ControlInt = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		this._super();
		this.$input
			.css({"text-align": "right"})
			.on("focus", function() {
				setTimeout(function() { 
					if(!document.activeElement) return;
					me.validate(document.activeElement.value, function(val) {
						document.activeElement.value = val;
					});
					document.activeElement.select() 
				}, 100);
				return false;
			})
	},
	validate: function(value, callback) {
		return callback(cint(value, null));
	}
});

frappe.ui.form.ControlFloat = frappe.ui.form.ControlInt.extend({
	validate: function(value, callback) {
		return callback(isNaN(parseFloat(value)) ? null : flt(value));
	},
	format_for_input: function(value) {
		var formatted_value = format_number(parseFloat(value), 
			null, cint(frappe.boot.sysdefaults.float_precision, null));
		return isNaN(parseFloat(value)) ? "" : formatted_value;
	}
});

frappe.ui.form.ControlCurrency = frappe.ui.form.ControlFloat.extend({
	format_for_input: function(value) {
		var formatted_value = format_number(parseFloat(value), 
			get_number_format(this.get_currency()));
		return isNaN(parseFloat(value)) ? "" : formatted_value;
	},
	get_currency: function() {
		return frappe.meta.get_field_currency(this.df, this.get_doc());
	}
});

frappe.ui.form.ControlPercent = frappe.ui.form.ControlFloat;

frappe.ui.form.ControlDate = frappe.ui.form.ControlData.extend({
	datepicker_options: {
		altFormat:'yy-mm-dd', 
		changeYear: true,
		yearRange: "-70Y:+10Y",
	},
	make_input: function() {
		this._super();
		this.set_datepicker();
	},
	set_datepicker: function() {
		this.datepicker_options.dateFormat = 
			(frappe.boot.sysdefaults.date_format || 'yyyy-mm-dd').replace("yyyy", "yy")
		this.$input.datepicker(this.datepicker_options);
	},
	parse: function(value) {
		return value ? dateutil.user_to_str(value) : value;
	},
	format_for_input: function(value) {
		return value ? dateutil.str_to_user(value) : "";
	},
	validate: function(value, callback) {
		var value = frappe.datetime.validate(value);
		if(!value) {
			msgprint (frappe._("Date must be in format") + ": " + (sys_defaults.date_format || "yyyy-mm-dd"));
			callback("");
		}
		return callback(value);
	}
})

import_timepicker = function() {
	frappe.require("assets/frappe/js/lib/jquery/jquery.ui.slider.min.js");
	frappe.require("assets/frappe/js/lib/jquery/jquery.ui.sliderAccess.js");
	frappe.require("assets/frappe/js/lib/jquery/jquery.ui.timepicker-addon.css");
	frappe.require("assets/frappe/js/lib/jquery/jquery.ui.timepicker-addon.js");	
}

frappe.ui.form.ControlTime = frappe.ui.form.ControlData.extend({
	make_input: function() {
		import_timepicker();
		this._super();
		this.$input.timepicker({
			timeFormat: 'hh:mm:ss',
		});
	}
});

frappe.ui.form.ControlDatetime = frappe.ui.form.ControlDate.extend({
	set_datepicker: function() {
		this.datepicker_options.timeFormat = "hh:mm:ss";
		this.datepicker_options.dateFormat = 
			(frappe.boot.sysdefaults.date_format || 'yy-mm-dd').replace('yyyy','yy');
		
		this.$input.datetimepicker(this.datepicker_options);
	},
	make_input: function() {
		import_timepicker();
		this._super();
	},
	
});

frappe.ui.form.ControlText = frappe.ui.form.ControlData.extend({
	html_element: "textarea",
	horizontal: false
});

frappe.ui.form.ControlLongText = frappe.ui.form.ControlText;
frappe.ui.form.ControlSmallText = frappe.ui.form.ControlText;

frappe.ui.form.ControlCheck = frappe.ui.form.ControlData.extend({
	input_type: "checkbox",
	make_wrapper: function() {
		this.$wrapper = $('<div class="form-group row" style="margin: 0px;">\
		<div class="col-md-offset-4 col-md-8">\
			<div class="checkbox" style="margin: 5px 0px">\
				<label>\
					<span class="input-area"></span>\
					<span class="disp-area" style="display:none;"></span>\
					<span class="label-area small"></span>\
				</label>\
				<p class="help-box small text-muted"></p>\
			</div>\
		</div>\
		</div>').appendTo(this.parent)
	},
	set_input_areas: function() {
		this.label_area = this.label_span = this.$wrapper.find(".label-area").get(0);
		this.input_area = this.$wrapper.find(".input-area").get(0);
		this.disp_area = this.$wrapper.find(".disp-area").get(0);	
	},
	make_input: function() {
		this._super();
		this.$input.removeClass("form-control");
	},
	parse: function(value) {
		return this.input.checked ? 1 : 0;
	},
	validate: function(value, callback) {
		return callback(cint(value));
	},
	set_input: function(value) {
		this.input.checked = value ? 1 : 0;
		this.last_value = value;
	}
});

frappe.ui.form.ControlButton = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		this.$input = $('<button class="btn btn-default">')
			.prependTo(me.input_area)
			.on("click", function() {
				me.onclick();
			});
		this.input = this.$input.get(0);
		this.set_input_attributes();
		this.has_input = true;
	},
	onclick: function() {
		if(this.frm && this.frm.doc && this.frm.cscript) {
			if(this.frm.cscript[this.df.fieldname]) {
				this.frm.script_manager.trigger(this.df.fieldname, this.doctype, this.docname);
			} else {
				this.frm.runscript(this.df.options, this);
			}
		}
		else if(this.df.click) {
			this.df.click();
		}
	},
	set_input_areas: function() {
		this._super();
		$(this.disp_area).removeClass();
	},
	set_empty_description: function() {
		this.$wrapper.find(".help-box").empty().toggle(false);
	},
	set_label: function() {
		$(this.label_span).html("&nbsp;");
		this.$input && this.$input.html(this.df.label);
	}
});

frappe.ui.form.ControlAttach = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		this.$input = $('<button class="btn btn-default">')
			.html(frappe._("Upload"))
			.prependTo(me.input_area)
			.on("click", function() {
				me.onclick();
			});
		this.$value = $('<div class="alert alert-info">\
			<a class="attached-file text-ellipsis" style="width: 80%" target="_blank"></a>\
			<a class="close">&times;</a></div>')
			.prependTo(me.input_area)
			.toggle(false);
		this.input = this.$input.get(0);
		this.set_input_attributes();
		this.has_input = true;
		
		this.$value.find(".close").on("click", function() {
			if(me.frm) {
				me.frm.attachments.remove_attachment_by_filename(me.value, function() {
					me.parse_validate_and_set_in_model(null);
					me.refresh();
				});
			} else {
				me.dataurl = null;
				me.fileobj = null;
				me.set_input(null);
				me.refresh();
			}
		})
	},
	onclick: function() {
		if(!this.dialog) {
			this.dialog = new frappe.ui.Dialog({
				title: frappe._(this.df.label || frappe._("Upload")),
			});
		}

		$(this.dialog.body).empty();
		
		this.set_upload_options();		
		frappe.upload.make(this.upload_options);
		this.dialog.show();
	},
	
	set_upload_options: function() {
		var me = this;
		this.upload_options = {
			parent: this.dialog.body,
			args: {},
			max_width: this.df.max_width,
			max_height: this.df.max_height,
			callback: function(fileid, filename, r) { 
				me.dialog.hide();
				me.on_upload_complete(fileid, filename, r);
			},
			onerror: function() {
				me.dialog.hide();
			},
		}
		
		if(this.frm) {
			this.upload_options.args = {
				from_form: 1,
				doctype: this.frm.doctype,
				docname: this.frm.docname,
			} 
		} else {
			this.upload_options.on_attach = function(fileobj, dataurl) {
				me.dialog.hide();
				me.fileobj = fileobj;
				me.dataurl = dataurl;
				if(me.on_attach) {
					me.on_attach()
				}
				if(me.df.on_attach) {
					me.df.on_attach(fileobj, dataurl);
				}
				me.on_upload_complete();
			}
		}
	},
	
	set_input: function(value, dataurl) {
		this.value = value;
		if(this.value) {
			this.$input.toggle(false);
			this.$value.toggle(true).find(".attached-file")
				.html(this.value)
				.attr("href", dataurl || this.value);
		} else {
			this.$input.toggle(true);
			this.$value.toggle(false);
		}
	},
	
	get_value: function() {
		if(this.frm) {
			return this.value;
		} else {
			return this.fileobj ? (this.fileobj.filename + "," + this.dataurl) : null;
		}
	},
	
	on_upload_complete: function(fileid, filename, r) {
		if(this.frm) {
			this.parse_validate_and_set_in_model(filename);
			this.refresh();
			this.frm.attachments.update_attachment(fileid, filename, this.df.fieldname, r);
		} else {
			this.set_input(this.fileobj.filename, this.dataurl);
			this.refresh();
		}
	},
});

frappe.ui.form.ControlAttachImage = frappe.ui.form.ControlAttach.extend({
	make_input: function() {
		this._super();
		this.img = $("<img class='img-responsive'>").appendTo($('<div style="margin: 7px 0px;">\
			<div class="missing-image"><i class="icon-camera"></i></div></div>')
			.prependTo(this.input_area)).toggle(false);
			
		var me = this;
		this.$wrapper.on("refresh", function() {
			if(me.value) {
				$(me.input_area).find(".missing-image").toggle(false);
				me.img.attr("src", me.dataurl ? me.dataurl : me.value).toggle(true);
			} else {
				$(me.input_area).find(".missing-image").toggle(true);
				me.img.toggle(false);
			}
		});
	},
});


frappe.ui.form.ControlSelect = frappe.ui.form.ControlData.extend({
	html_element: "select",
	make_input: function() {
		var me = this;
		this._super();
		if(this.df.options=="attach_files:") {
			this.setup_attachment();
		}
		this.set_options();
	},
	set_input: function(value) {
		// refresh options first - (new ones??)
		this.set_options(value || "");

		this._super(value);

		// not a possible option, repair
		if(this.doctype && this.docname) {
			// model value is not an option,
			// set the default option (displayed)
			var input_value = this.$input.val();
			var model_value = frappe.model.get_value(this.doctype, this.docname, this.df.fieldname);
			if(model_value == null && input_value != (model_value || "")) {
				this.set_model_value(input_value);
			} else {
				this.last_value = value;
			}
		}
	},
	setup_attachment: function() {
		var me = this;
		$(this.input).css({"width": "85%", "display": "inline-block"});
		this.$attach = $("<button class='btn btn-default' title='"+ frappe._("Add attachment") + "'\
			style='padding-left: 6px; padding-right: 6px; margin-right: 6px;'>\
			<i class='icon-plus'></i></button>")
			.click(function() {
				me.frm.attachments.new_attachment(me.df.fieldname);
			})
			.prependTo(this.input_area);
			
		$(document).on("upload_complete", function(event, filename, file_url) {
			if(cur_frm === me.frm) {
				me.set_options();
			}
		})

		this.$wrapper.on("refresh", function() {
			me.$attach.toggle(!me.frm.doc.__islocal);
		});
	},
	set_options: function(value) {
		var options = this.df.options || [];
		if(this.df.options=="attach_files:") {
			options = this.get_file_attachment_list();
		} else if(typeof this.df.options==="string") {
			options = this.df.options.split("\n");
		}

		if(this.in_filter && options[0] != "") {
			options = add_lists([''], options);
		}

		var selected = this.$input.find(":selected").val();
		this.$input.empty().add_options(options || []);

		if(value===undefined && selected) this.$input.val(selected);
	},
	get_file_attachment_list: function() {
		if(!this.frm) return;
		var fl = frappe.model.docinfo[this.frm.doctype][this.frm.docname];
		if(fl && fl.attachments) {
			fl = fl.attachments;
			this.set_description("");
			var options = [""];
			for(var fname in fl) {
				if(fname.indexOf("/")===-1)
					fname = "files/" + fname;
				options.push(fname);
			}
			return options;
		} else {
			this.set_description(frappe._("Please attach a file first."))
			return [""];
		}
	}
});

// special features for link
// buttons
// autocomplete
// link validation
// custom queries
// add_fetches
frappe.ui.form.ControlLink = frappe.ui.form.ControlData.extend({
	make_input: function() {
		var me = this;
		$('<div class="link-field" style="display: table; width: 100%;">\
			<input type="text" class="input-with-feedback form-control" \
				style="display: table-cell">\
			<span class="link-field-btn" style="display: table-cell">\
				<a class="btn-search" title="Search Link">\
					<i class="icon-search"></i>\
				</a><a class="btn-open" title="Open Link">\
					<i class="icon-play"></i>\
				</a><a class="btn-new" title="Make New">\
					<i class="icon-plus"></i>\
				</a>\
			</span>\
		</div>').prependTo(this.input_area);
		this.$input_area = $(this.input_area);
		this.$input = this.$input_area.find('input');
		this.set_input_attributes();
		this.$input.on("focus", function() {
			setTimeout(function() {
				if(!me.$input.val()) {
					me.$input.val("%").trigger("keydown");
				}
			}, 1000)
		})
		this.input = this.$input.get(0);
		this.has_input = true;
		//this.bind_change_event();
		var me = this;
		this.setup_buttons();
		//this.setup_typeahead();
		this.setup_autocomplete();
	},
	setup_buttons: function() {
		var me = this;

		// magnifier - search
		this.$input_area.find(".btn-search").on("click", function() {
			new frappe.ui.form.LinkSelector({
				doctype: me.df.options,
				target: me,
				txt: me.get_value()
			});
		});

		// open
		if(frappe.model.can_read(me.df.options)) {
			this.$input_area.find(".btn-open").on("click", function() {
				var value = me.get_value();
				if(value && me.df.options) frappe.set_route("Form", me.df.options, value);
			});
		} else {
			this.$input_area.find(".btn-open").remove();
		}
		
		// new
		if(frappe.model.can_create(me.df.options)) {
			this.$input_area.find(".btn-new").on("click", function() {
				me.frm.new_doc(me.df.options, me);
			});
		} else {
			this.$input_area.find(".btn-new").remove();
		}
		
		if(this.only_input) this.$input_area.find(".btn-open, .btn-new").remove();
	},
	setup_autocomplete: function() {
		var me = this;
		this.$input.on("blur", function() { 
			if(me.selected) {
				me.selected = false;
				return;
			}
			if(me.doctype && me.docname) {
				var value = me.get_value();
				if(value!==me.last_value) {
					me.parse_validate_and_set_in_model(value);
				}
			}});

		this.$input.autocomplete({
			source: function(request, response) {
				var args = {
					'txt': request.term, 
					'doctype': me.df.options,
				};
		
				me.set_custom_query(args);
		
				return frappe.call({
					type: "GET",
					method:'frappe.widgets.search.search_link',
					no_spinner: true,
					args: args,
					callback: function(r) {
						response(r.results);
					},
				});
			},
			open: function(event, ui) {
				me.autocomplete_open = true;
			},
			close: function(event, ui) {
				me.autocomplete_open = false;
			},
			select: function(event, ui) {
				me.autocomplete_open = false;
				if(me.frm && me.frm.doc) {
					me.selected = true;
					me.parse_validate_and_set_in_model(ui.item.value);
				} else {
					me.$input.val(ui.item.value);
					me.$input.trigger("change");
				}
			}
		}).data('ui-autocomplete')._renderItem = function(ul, d) {
			var html = "";
			if(keys(d).length > 1) {
				d.info = $.map(d, function(val, key) { return ["value", "label"].indexOf(key)!==-1 ? null : val }).join(", ") || "";
				html = repl("<a>%(value)s<br><span class='text-muted'>%(info)s</span></a>", d);
			} else {
				html = "<a>" + d.value + "</a>";
			}

			return $('<li></li>')
				.data('item.autocomplete', d)
				.append(html)
				.appendTo(ul);
		};
		// remove accessibility span (for now)
		this.$wrapper.find(".ui-helper-hidden-accessible").remove();
	},
	set_custom_query: function(args) {
		var set_nulls = function(obj) {
			$.each(obj, function(key, value) {
				if(value!==undefined) {
					obj[key] = value || null;
				}
			});
			return obj;
		}
		if(this.get_query || this.df.get_query) {
			var get_query = this.get_query || this.df.get_query;
			if($.isPlainObject(get_query)) {
				$.extend(args, set_nulls(get_query));
			} else if(typeof(get_query)==="string") {
				args.query = get_query;
			} else {
				var q = (get_query)(this.frm && this.frm.doc, this.doctype, this.docname);

				if (typeof(q)==="string") {
					args.query = q;
				} else if($.isPlainObject(q)) {
					if(q.filters) {
						set_nulls(q.filters);
					}
					$.extend(args, q);
				}
			}
		}
	},
	validate: function(value, callback) {
		// validate the value just entered
		var me = this;

		if(this.df.options=="[Select]") {
			callback(value);
			return;
		}
		
		this.frm.script_manager.validate_link_and_fetch(this.df, this.docname, value, callback);
	},
});


frappe.ui.form.ControlCode = frappe.ui.form.ControlText.extend({
	make_input: function() {
		this._super();
		$(this.input_area).find("textarea").css({"height":"400px", "font-family": "Monaco, \"Courier New\", monospace"});
	}
});

frappe.ui.form.ControlTextEditor = frappe.ui.form.ControlCode.extend({
	editor_name: "bsEditor",
	horizontal: false,
	make_input: function() {
		$(this.input_area).css({"min-height":"360px"});
		var me = this;
		this.editor = new (frappe.provide(this.editor_name))({
			parent: this.input_area,
			change: function(value) {
				me.parse_validate_and_set_in_model(value);
			},
			field: this
		});
		this.has_input = true;
		this.editor.editor.keypress("ctrl+s meta+s", function() {
			me.frm.save_or_update();
		});
	},
	get_value: function() {
		return this.editor.get_value();
	},
	set_input: function(value) {
		this.editor.set_input(value);
		this.last_value = value;
	}
});

frappe.ui.form.ControlTable = frappe.ui.form.Control.extend({
	make: function() {
		this._super();
		
		// add title if prev field is not column / section heading or html
		var prev_fieldtype = frappe.model.get("DocField", 
			{parent: this.frm.doctype, idx: this.df.idx-1})[0].fieldtype;
					
		if(["Column Break", "Section Break", "HTML"].indexOf(prev_fieldtype)===-1) {
			$("<label>" + this.df.label + "<label>").appendTo(this.wrapper);	
		}
		
		this.grid = new frappe.ui.form.Grid({
			frm: this.frm,
			df: this.df,
			perm: this.perm || this.frm.perm,
			parent: this.wrapper
		})
		if(this.frm)
			this.frm.grids[this.frm.grids.length] = this;

		// description
		if(this.df.description) {
			$('<p class="text-muted small">' + frappe._(this.df.description) + '</p>')
				.appendTo(this.wrapper);
		}
		
		var me = this;
		this.$wrapper.on("refresh", function() {
			me.grid.refresh();
			return false;
		});
	}
})

frappe.ui.form.fieldtype_icons = {
	"Date": "icon-calendar",
	"Time": "icon-time",
	"Datetime": "icon-time",
	"Code": "icon-code",
	"Select": "icon-flag"
};
