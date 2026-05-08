/**
 * TREVO CLOUD — "The Verdant Precision Framework" Engine v14.0
 * The Digital Greenhouse: Premium Overlaid Experience.
 */

class TrevoTheme {
    constructor() {
        this.version = "14.2";
        this.primaryColor = "#6ba44b";
        this.init();
    }

    init() {
        this.injectFonts();
        this.setFavicon("/assets/trevo_whitelabel/images/TrevoCloudLogo.svg");

        $(document).on("app_ready", () => {
            console.log(`%c Trevo Engine ${this.version} %c`, "background: #6ba44b; color: #fff; padding: 5px 10px; border-radius: 4px; font-family: 'Inter Tight', sans-serif; font-weight: 700;", "Verdant Zenith");
            this.setupOverrides();
            this.applyBranding();
            this.initMutationObserver();
            this.setupKeyboardShortcuts();
        });

        $(document).on("page-change", () => {
            setTimeout(() => this.applyBranding(), 100);
        });

        // Instant check for login page
        if (window.location.pathname.includes("login") || $("body").hasClass("for-login")) {
            this.forceLoginBranding();
        }
    }

    setupKeyboardShortcuts() {
        $(document).on("keydown", (e) => {
            // Trigger Command Palette with Ctrl+P or Cmd+K
            if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "k")) {
                e.preventDefault();
                frappe.search.show();
            }
        });
    }

    injectFonts() {
        if (!document.getElementById("trevo-fonts")) {
            const link = document.createElement("link");
            link.id = "trevo-fonts";
            link.rel = "stylesheet";
            link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Inter+Tight:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap";
            document.head.appendChild(link);
        }
    }

    setupOverrides() {
        if (frappe.ui.Sidebar && !frappe.ui.Sidebar.prototype._trevo_modified) {
            const originalMake = frappe.ui.Sidebar.prototype.make;
            frappe.ui.Sidebar.prototype.make = function() {
                originalMake.apply(this, arguments);
                this.wrapper.addClass("trevo-sidebar-v14");
            };
            frappe.ui.Sidebar.prototype._trevo_modified = true;
        }

        this.overrideAboutDialog();
    }

    overrideAboutDialog() {
        $(document).on("app_ready", () => {
            if (frappe.ui && frappe.ui.misc) {
                frappe.ui.misc.about = function () {
                    if (frappe.ui.misc.about_dialog) {
                        frappe.ui.misc.about_dialog.show();
                        return;
                    }

                    const dialog = new frappe.ui.Dialog({ title: "Trevo Cloud Framework" });
                    
                    $(dialog.body).html(
                        `<div>
                                <p>The Verdant Precision Framework for the Web</p>
                                <hr>
                                <div class="d-flex align-items-center justify-content-between">
                                    <h4>Installed Modules</h4>
                                    <button class="btn action-btn hidden" id="copy-apps-info" title="Copy Apps Version" style="margin-bottom: var(--margin-md);">
                                        ${frappe.utils ? frappe.utils.icon("clipboard") : ""}
                                    </button>
                                </div>
                                <div id='about-app-versions'>Loading modules...</div>
                                <hr>
                                <p class='text-muted'>&copy; Dots and Dashes Technologies</p>
                            </div>`
                    );

                    frappe.ui.misc.about_dialog = dialog;

                    frappe.ui.misc.about_dialog.on_page_show = function () {
                        if (!frappe.versions) {
                            frappe.call({
                                method: "frappe.utils.change_log.get_versions",
                                callback: function (r) {
                                    show_versions(r.message);
                                },
                            });
                        } else {
                            show_versions(frappe.versions);
                        }
                    };

                    const show_versions = function (versions) {
                        const $wrap = $("#about-app-versions").empty();
                        let app = {};

                        function get_version_text(app) {
                            if (app.branch) {
                                return `v${app.branch_version || app.version} (${app.branch})`;
                            } else {
                                return `v${app.version}`;
                            }
                        }

                        for (const app_name in versions) {
                            app = versions[app_name];
                            const title = `${app_name}: ${app.branch_version || app.version}`;
                            let display_title = app.title;
                            if (display_title === "Frappe Framework") display_title = "Trevo Framework";
                            if (display_title === "ERPNext") display_title = "TrevoERP";
                            
                            const text = `<p class='app-version' role='button' title='${title}'>
                                            <b>${display_title}:</b> ${get_version_text(app)}
                                        </p>`;
                            $(text).appendTo($wrap);
                        }

                        frappe.versions = versions;

                        if (frappe.versions) {
                            $(dialog.body).find("#copy-apps-info").removeClass("hidden");
                        }
                    };

                    frappe.ui.misc.about_dialog.show();
                };
            }
        });
    }

    applyBranding() {
        if ($("body").hasClass("for-login")) {
            this.applyLoginBranding();
        }

        $(".layout-side-section, .standard-sidebar").addClass("trevo-sidebar-v14");
        this.replaceLogos();
        this.colorizeIcons();
        this.polishSearchBar();
    }

    replaceLogos() {
        const trevoLogo = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";
        const logoSelectors = ["#brand-logo", ".app-logo", ".frappe-logo", "img[src*='frappe-framework-logo.svg']", "img[src*='frappe-logo.svg']", ".navbar-brand img"];

        $(logoSelectors.join(", ")).each((_, img) => {
            const $img = $(img);
            if ($img.attr("src") !== trevoLogo) {
                $img.attr("src", trevoLogo);
                if ($img.attr("id") === "brand-logo") {
                    $img.css({ "max-height": "24px", "width": "auto", "filter": "none" });
                }
            }
        });

        $(".navbar-brand").css("background-image", "none");
    }

    forceLoginBranding() {
        let attempts = 0;
        const interval = setInterval(() => {
            this.applyLoginBranding();
            this.replaceLogos();
            attempts++;
            if (attempts > 10) clearInterval(interval);
        }, 200);
    }

    applyLoginBranding() {
        const section = $("section.for-login, section.for-signup, section.for-forgot, section.for-email-login").filter(":visible");
        if (!section.length) return;

        this.enhanceLoginLayout(section);

        const trevoLogo = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";
        const cardHead = section.find(".page-card-head");
        if (cardHead.length && !cardHead.hasClass("trevo-branded")) {
            cardHead.addClass("trevo-branded").html(`
                <img class="app-logo" src="${trevoLogo}" style="max-height: 60px; margin-bottom: 20px;">
                <h4 style="font-weight: 800; font-size: 28px; color: #143628; margin: 0;">Login to Trevo</h4>
                <p style="margin-top: 10px; color: #7a8782; font-size: 15px;">Access your unified commerce workspace</p>
            `);
        }
    }

    enhanceLoginLayout(section) {
        if (section.find(".trevo-login-shell").length || $(".trevo-login-page").length) return;

        section.wrapInner('<div class="trevo-login-shell"></div>');
        const shell = section.find(".trevo-login-shell");
        shell.wrapInner('<div class="trevo-login-form-column"></div>');
        shell.prepend(`
            <section class="trevo-login-showcase">
                <div class="trevo-login-showcase__inner">
                    <p class="trevo-login-eyebrow">Trevo Cloud Framework</p>
                    <h1>One Platform,<br>All Solutions.</h1>
                    <p class="trevo-login-copy">Empowering Nepalese commerce with a unified ecosystem designed for growth and precision.</p>
                </div>
            </section>
        `);
    }

    colorizeIcons() {
        $("svg").each((_, svg) => {
            const $svg = $(svg);
            const stroke = $svg.attr("stroke");
            if (stroke && (stroke.toLowerCase() === "#1f272e" || stroke.toLowerCase() === "#007bff")) {
                $svg.attr("stroke", this.primaryColor);
            }
        });
    }

    polishSearchBar() {
        const searchInput = $(".navbar-form.navbar-left input, .search-bar input, .awesomebar input, .navbar-search input");
        searchInput.each((_, el) => {
            const $el = $(el);
            if (!$el.hasClass("trevo-search-polished")) {
                $el.attr("placeholder", "Search Trevo...");
                $el.addClass("trevo-search-polished");
            }
        });
    }

    initMutationObserver() {
        let timeout;
        const observer = new MutationObserver(() => {
            clearTimeout(timeout);
            timeout = setTimeout(() => this.applyBranding(), 150);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    setFavicon(url) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }
        link.href = url;
    }
}

frappe.provide("trevo");
trevo.engine = new TrevoTheme();
