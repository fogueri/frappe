# Copyright (c) 2013, Web Notes Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from __future__ import unicode_literals
import frappe


def remove_empty_permissions():
	permissions_cache_to_be_cleared = frappe.db.sql_list("""select distinct profile 
		from `tabWebsite Route Permission`
		where ifnull(`read`, 0)=0 and ifnull(`write`, 0)=0 and ifnull(`admin`, 0)=0""")
	
	frappe.db.sql("""delete from `tabWebsite Route Permission`
		where ifnull(`read`, 0)=0 and ifnull(`write`, 0)=0 and ifnull(`admin`, 0)=0""")
		
	clear_permissions(permissions_cache_to_be_cleared)

def get_access(sitemap_page, profile=None):
	profile = profile or frappe.session.user
	key = "website_route_permissions:{}".format(profile)
	
	cache = frappe.cache()
	permissions = cache.get_value(key) or {}
	if not permissions.get(sitemap_page):
		permissions[sitemap_page] = _get_access(sitemap_page, profile)
		cache.set_value(key, permissions)
		
	return permissions.get(sitemap_page)
	
def _get_access(sitemap_page, profile):
	lft, rgt, public_read, public_write, page_or_generator = frappe.db.get_value("Website Route", sitemap_page, 
		["lft", "rgt", "public_read", "public_write", "page_or_generator"])

	read = write = admin = private_read = 0

	if page_or_generator=="Generator":

		if not (lft and rgt):
			raise frappe.ValidationError("Please rebuild Website Route Tree")
		
		if profile == "Guest":
			return { "read": public_read, "write": 0, "admin": 0 }
		

		if public_write:
			read = write = 1
		elif public_read:
			read = 1

		for perm in frappe.db.sql("""select wsp.`read`, wsp.`write`, wsp.`admin`, 
			ws.lft, ws.rgt, ws.name
			from `tabWebsite Route Permission` wsp, `tabWebsite Route` ws
			where wsp.profile = %s and wsp.website_route = ws.name 
			order by lft asc""", (profile,), as_dict=True):
			if perm.lft <= lft and perm.rgt >= rgt:
				if not (public_read or private_read): private_read = perm.read
				if not read: read = perm.read
				if not write: write = perm.write
				if not admin: admin = perm.admin
				if write: read = write
	
			if read and write and admin:
				break
				
	else:
		read = write = admin = private_read = 1
		
	return { "read": read, "write": write, "admin": admin, "private_read": private_read }

def clear_permissions(profiles=None):
	if isinstance(profiles, basestring):
		profiles = [profiles]
	elif profiles is None:
		profiles = frappe.db.sql_list("""select name from `tabProfile`""")
	
	cache = frappe.cache()
	for profile in profiles:
		cache.delete_value("website_route_permissions:{}".format(profile))
