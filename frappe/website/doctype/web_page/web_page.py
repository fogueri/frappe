# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from __future__ import unicode_literals
import frappe, os, time
from frappe.website.website_generator import WebsiteGenerator
from frappe.website.utils import cleanup_page_name
from frappe.utils import cint

class DocType(WebsiteGenerator):			
	def validate(self):
		for d in self.doclist.get({"parentfield": "toc"}):
			if d.web_page == self.doc.name:
				frappe.throw('{web_page} "{name}" {not_in_own} {toc}'.format(
					web_page=_("Web Page"), name=d.web_page,
					not_in_own=_("cannot be in its own"), toc=_(self.meta.get_label("toc"))))

	def on_update(self):
		WebsiteGenerator.on_update(self)
		
		# clear all cache if it has toc
		if self.doclist.get({"parentfield": "toc"}):
			from frappe.website.render import clear_cache
			clear_cache()
						
	def on_trash(self):
		# delete entry from Table of Contents of other pages
		WebsiteGenerator.on_trash(self)
		
		frappe.db.sql("""delete from `tabTable of Contents`
			where web_page=%s""", self.doc.name)
		
		# clear all cache if it has toc
		if self.doclist.get({"parentfield": "toc"}):
			from frappe.website.render import clear_cache
			clear_cache()

