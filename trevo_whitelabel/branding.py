import frappe

def get_context(context):
    """
    Force Trevo branding into the website context.
    """
    context.app_name = "Trevo"
    context.app_title = "Trevo Cloud"
    context.logo = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
    context.favicon = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
    
    # Independent Home Page Logic
    # ---------------------------
    # If ecommerce is installed, use its home page. 
    # Otherwise, ensure we don't redirect to login by defaulting to 'index'.
    installed_apps = frappe.get_installed_apps()
    if "denimnation_ecommerce" in installed_apps:
        context.home_page = "shop"
    else:
        context.home_page = "index"

    return context
