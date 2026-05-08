import frappe

def run():
    # Set the universal injection into Website Settings
    # We use the standard paths which are symlinked to the latest built assets
    head_html = ""
    trevo_logo = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
    
    print("🎨 Injecting Trevo branding...")
    
    frappe.db.set_single_value('Website Settings', 'head_html', head_html)
    frappe.db.set_single_value('Website Settings', 'app_logo', trevo_logo)
    frappe.db.set_single_value('Website Settings', 'splash_image', trevo_logo)
    frappe.db.set_single_value('Website Settings', 'favicon', trevo_logo)
    
    # Navbar Settings (Desk)
    frappe.db.set_single_value('Navbar Settings', 'app_logo', trevo_logo)
    
    frappe.db.commit()
    print("✅ Trevo Universal Branding injected into Website Settings successfully.")

if __name__ == "__main__":
    run()
