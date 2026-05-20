import os
import shutil
from pathlib import Path


def run():
	print("=" * 60)
	print("Trevo Form Builder Customizer: Starting...")
	print("=" * 60)

	bench_apps_dir = Path("/home/frappe/frappe-bench/apps")
	if not bench_apps_dir.exists():
		script_dir = Path(__file__).resolve().parent
		for parent in script_dir.parents:
			if (parent / "apps" / "frappe").exists():
				bench_apps_dir = parent / "apps"
				break
		else:
			bench_apps_dir = script_dir.parents[4] / "apps"

	frappe_fb_dir = bench_apps_dir / "frappe" / "frappe" / "public" / "js" / "form_builder"
	frappe_form_dir = bench_apps_dir / "frappe" / "frappe" / "public" / "js" / "frappe" / "form"
	custom_src = Path(__file__).resolve().parent.parent / "public" / "custom_form_builder"

	if not frappe_fb_dir.exists():
		print(f"[ERROR] Form Builder dir not found: {frappe_fb_dir}")
		return

	if not frappe_form_dir.exists():
		print(f"[ERROR] Form dir not found: {frappe_form_dir}")
		return

	# ── Form Builder Vue files (canvas / studio) ──────────────────
	builder_replacements = [
		("FormBuilder.vue",  frappe_fb_dir / "FormBuilder.vue"),
		("Sidebar.vue",      frappe_fb_dir / "components" / "Sidebar.vue"),
		("Section.vue",      frappe_fb_dir / "components" / "Section.vue"),
		("Column.vue",       frappe_fb_dir / "components" / "Column.vue"),
		# SectionStats is a new component — no orig backup needed
		("SectionStats.vue", frappe_fb_dir / "components" / "SectionStats.vue"),
	]

	# ── Live form JS files (doctype rendering) ────────────────────
	# These Trevo live-form patches replace Frappe's default section/column
	# renderer with the Trevo form experience.
	live_replacements = [
		("section_live.js", frappe_form_dir / "section.js"),
		("column_live.js",  frappe_form_dir / "column.js"),
	]

	all_replacements = builder_replacements + live_replacements

	for filename, dest_path in all_replacements:
		src_path = custom_src / filename
		if not src_path.exists():
			print(f"  [SKIP] Source not found: {filename}")
			continue

		dest_path.parent.mkdir(parents=True, exist_ok=True)

		backup_path = dest_path.with_suffix(dest_path.suffix + ".orig")
		if not backup_path.exists() and dest_path.exists():
			shutil.copy2(dest_path, backup_path)
			print(f"  [BACKUP] {dest_path.name}")

		shutil.copy2(src_path, dest_path)
		print(f"  [PATCHED] {dest_path.relative_to(bench_apps_dir)}")

	print("=" * 60)
	print("Trevo Form Builder Customizer: Completed.")
	print("=" * 60)


if __name__ == "__main__":
	run()
