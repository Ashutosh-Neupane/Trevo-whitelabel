# Trevo Whitelabel

Premium visual identity layer for Frappe/ERPNext v16. Transforms the standard system into the **Trevo Cloud Framework** with a Leaf Green design system.

## 🚀 Key Features
- **Radical UI Overhaul**: Card-based forms, stepper-style tabs, and deep forest anchors.
- **Universal Rebranding**: ERPNext -> TrevoERP, Frappe -> Trevo Framework.
- **Custom Design System**: Leaf Green (#6ba44b) palette with Inter Tight typography.
- **SVG Repainting**: Automatically colorizes system icons to match the brand.
- **Splash & Logo**: Custom Trevo loading screens and navbar branding.

## 🛠 Installation

1. Install the app on your site:
   ```bash
   bench --site [your-site] install-app trevo_whitelabel
   ```

2. Run the rebranding script to apply colors and naming:
   ```bash
   bench --site [your-site] execute trevo_whitelabel.scripts.rebrand_to_trevo.run
   ```

3. Repaint system icons (optional but recommended):
   ```bash
   bench --site [your-site] execute trevo_whitelabel.scripts.repaint_svgs.run
   ```

## 📦 Asset Management (Docker)

In a containerized environment, follow these steps to ensure assets are served correctly without 404 errors:

1. **Build Assets**:
   ```bash
   bench build --app trevo_whitelabel --force
   ```

2. **Synchronize Volumes**:
   Because Docker containers use separate filesystems, you must physically copy the built assets to the shared `assets` volume (since Nginx cannot follow symlinks to the `apps` folder):
   ```bash
   # Remove old symlink
   rm -rf sites/assets/trevo_whitelabel
   
   # Create directory and copy files
   mkdir -p sites/assets/trevo_whitelabel
   cp -rf apps/trevo_whitelabel/trevo_whitelabel/public/. sites/assets/trevo_whitelabel/
   ```

3. **Clear Cache**:
   ```bash
   bench --site [your-site] clear-cache
   ```

## 🎨 Configuration
Visual styles are managed in `trevo_whitelabel/public/scss/trevo_v1.bundle.scss`.
Global JS engine logic resides in `trevo_whitelabel/public/js/trevo_v1.bundle.js`.

---
© 2026 Dots and Dashes Technologies
