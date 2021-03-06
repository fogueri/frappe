# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from __future__ import unicode_literals

import frappe
import unittest, sys

from frappe.model.meta import has_field
from frappe.model.code import load_doctype_module, get_module_name
from frappe.model.doctype import get_link_fields
from frappe.utils import cstr


def main(app=None, module=None, doctype=None, verbose=False):	
	frappe.flags.print_messages = verbose
	frappe.flags.in_test = True
	
	if not frappe.db:
		frappe.connect()
	
	if doctype:
		ret = run_unittest(doctype, verbose=verbose)
	elif module:
		import importlib
		
		test_suite = unittest.TestSuite()
		module = importlib.import_module(module)
		if hasattr(module, "test_dependencies"):
			for doctype in module.test_dependencies:
				make_test_records(doctype, verbose=verbose)
		
		test_suite.addTest(unittest.TestLoader().loadTestsFromModule(module))
		ret = unittest.TextTestRunner(verbosity=1+(verbose and 1 or 0)).run(test_suite)
	else:
		ret = run_all_tests(app, verbose)
	return ret

def run_all_tests(app=None, verbose=False):
	import os

	apps = [app] if app else frappe.get_installed_apps()

	test_suite = unittest.TestSuite()
	for app in apps:
		for path, folders, files in os.walk(frappe.get_pymodule_path(app)):
			for dontwalk in ('locals', '.git', 'public'):
				if dontwalk in folders: 
					folders.remove(dontwalk)
				
			# print path
			for filename in files:
				filename = cstr(filename)
				if filename.startswith("test_") and filename.endswith(".py"):
					# print filename[:-3]
					_run_test(path, filename, verbose, test_suite=test_suite, run=False)
				
	return unittest.TextTestRunner(verbosity=1+(verbose and 1 or 0)).run(test_suite)

def _run_test(path, filename, verbose, test_suite=None, run=True):
	import os, imp
	from frappe.modules.utils import peval_doclist
	
	if not test_suite:
		test_suite = unittest.TestSuite()
	
	if os.path.basename(os.path.dirname(path))=="doctype":
		txt_file = os.path.join(path, filename[5:].replace(".py", ".txt"))
		with open(txt_file, 'r') as f:
			doctype_doclist = peval_doclist(f.read())
		doctype = doctype_doclist[0]["name"]
		make_test_records(doctype, verbose)
	
	module = imp.load_source(filename[:-3], os.path.join(path, filename))
	test_suite.addTest(unittest.TestLoader().loadTestsFromModule(module))
	
	if run:
		unittest.TextTestRunner(verbosity=1+(verbose and 1 or 0)).run(test_suite)

def make_test_records(doctype, verbose=0):
	frappe.flags.mute_emails = True
		
	if not frappe.db:
		frappe.connect()
			
	for options in get_dependencies(doctype):
		if options.startswith("link:"):
			options = options[5:]
		if options == "[Select]":
			continue

		if options not in frappe.local.test_objects:
			frappe.local.test_objects[options] = []
			make_test_records(options, verbose)
			make_test_records_for_doctype(options, verbose)

def get_modules(doctype):
	module = frappe.db.get_value("DocType", doctype, "module")
	try:
		test_module = load_doctype_module(doctype, module, "test_")
		if test_module: 
			reload(test_module)
	except ImportError, e:
		test_module = None

	return module, test_module

def get_dependencies(doctype):
	module, test_module = get_modules(doctype)
	
	options_list = list(set([df.options for df in get_link_fields(doctype)] + [doctype]))
	
	if hasattr(test_module, "test_dependencies"):
		options_list += test_module.test_dependencies
	
	if hasattr(test_module, "test_ignore"):
		for doctype_name in test_module.test_ignore:
			if doctype_name in options_list:
				options_list.remove(doctype_name)
				
	return options_list

def make_test_records_for_doctype(doctype, verbose=0):
	module, test_module = get_modules(doctype)
	
	if verbose:
		print "Making for " + doctype

	if hasattr(test_module, "_make_test_records"):
		frappe.local.test_objects[doctype] += test_module._make_test_records(verbose)

	elif hasattr(test_module, "test_records"):
		frappe.local.test_objects[doctype] += make_test_objects(doctype, test_module.test_records, verbose)
	elif verbose:
		print_mandatory_fields(doctype)


def make_test_objects(doctype, test_records, verbose=None):
	records = []
		
	for doclist in test_records:
		if "doctype" not in doclist[0]:
			doclist[0]["doctype"] = doctype
		d = frappe.bean(copy=doclist)
		
		if frappe.local.test_objects.get(d.doc.doctype):
			# do not create test records, if already exists
			return []
		if has_field(d.doc.doctype, "naming_series"):
			if not d.doc.naming_series:
				d.doc.naming_series = "_T-" + d.doc.doctype + "-"

		# submit if docstatus is set to 1 for test record
		docstatus = d.doc.docstatus
		
		d.doc.docstatus = 0
		d.insert()

		if docstatus == 1:
			d.submit()
		
		records.append(d.doc.name)
	return records

def print_mandatory_fields(doctype):
	print "Please setup make_test_records for: " + doctype
	print "-" * 60
	doctype_obj = frappe.get_doctype(doctype)
	print "Autoname: " + (doctype_obj[0].autoname or "")
	print "Mandatory Fields: "
	for d in doctype_obj.get({"reqd":1}):
		print d.parent + ":" + d.fieldname + " | " + d.fieldtype + " | " + (d.options or "")
	print		

def run_unittest(doctype, verbose=False):
	module = frappe.db.get_value("DocType", doctype, "module")
	test_module = get_module_name(doctype, module, "test_")
	make_test_records(doctype, verbose=verbose)
	test_suite = unittest.TestSuite()	
	module = frappe.get_module(test_module)
	test_suite.addTest(unittest.TestLoader().loadTestsFromModule(module))
	return unittest.TextTestRunner(verbosity=1+(verbose and 1 or 0)).run(test_suite)
