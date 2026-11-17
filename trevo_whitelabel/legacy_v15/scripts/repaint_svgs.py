"""
repaint_svgs.py — Trevo SVG Color Repainter
============================================
Scans all SVG files across installed Frappe app directories and replaces
source brand colors (Frappe default blues) with the Trevo Emerald palette.

This script is designed to be robust, efficient, and compatible with both 
local development and containerized (Docker) environments.
"""

import os
import re
import logging
from pathlib import Path

# ── Logging Configuration ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("trevo.repaint_svgs")

# ── Color Configuration ───────────────────────────────────────────────────────
# Maps original Frappe/ERPNext hex colors  →  Trevo Emerald replacements.
DEFAULT_COLOR_MAP = [
    # Primary Blues → Trevo Primary Emerald (#6ba44b)
    ("#0289F7", "#6ba44b"),
    ("#0289f7", "#6ba44b"),
    ("#0981E3", "#6ba44b"),
    ("#0981e3", "#6ba44b"),
    ("#2D95F0", "#6ba44b"),
    ("#2d95f0", "#6ba44b"),
    ("#1F87EF", "#6ba44b"),
    ("#1f87ef", "#6ba44b"),
    ("#007bff", "#6ba44b"), # Standard Bootstrap Blue
    ("#007BFF", "#6ba44b"),
    ("#17a2b8", "#6ba44b"), # Info Blue/Teal
    ("#17A2B8", "#6ba44b"),
    ("#0089FF", "#6ba44b"),

    # Secondary/Darker Blues → Trevo Deep Forest (#467132)
    ("#0B313A", "#467132"),
    ("#0b313a", "#467132"),
    ("#112B42", "#467132"),
    ("#112b42", "#467132"),
    ("#048F6E", "#467132"),
    ("#048f6e", "#467132"),
    ("#3498db", "#467132"), # Flat UI Blue
    ("#2980b9", "#467132"),
    
    # Accent/Teal Shades → Trevo Primary Emerald
    ("#06B58B", "#006948"),
    ("#06b58b", "#006948"),
    ("#1F876C", "#006948"),
    ("#1f876c", "#006948"),
    ("#4C5A67", "#006948"),
    ("#4c5a67", "#006948"),
]

# Patterns to ignore during recursive search
IGNORE_PATTERNS = [
    "node_modules",
    "env",
    "venv",
    ".git",
    "__pycache__",
]

# Apps to skip (we don't want to touch our own branding assets)
SKIP_APPS = {"trevo_whitelabel"}

# ── Core Logic ────────────────────────────────────────────────────────────────

def get_bench_path() -> Path:
    """
    Resolves the bench root directory.
    Priority: FRAPPE_BENCH_PATH env var > Path walking.
    """
    env_bench = os.environ.get("FRAPPE_BENCH_PATH")
    if env_bench:
        return Path(env_bench)

    # Walk up from this script: 
    # apps/trevo_whitelabel/trevo_whitelabel/scripts/repaint_svgs.py
    p = Path(__file__).resolve()
    for parent in p.parents:
        if (parent / "apps" / "frappe").exists():
            return parent
    
    # Last resort fallback (standard dev bench depth)
    return p.parents[4]

def repaint_file(filepath: Path) -> bool:
    """
    Replaces all configured source colors with target colors in a single file.
    Supports hex and common blue-ish RGB values.
    """
    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        logger.debug(f"  [SKIP] Could not read {filepath}: {e}")
        return False

    original_content = content
    
    # 1. Direct Hex Replacements
    for source_hex, target_hex in DEFAULT_COLOR_MAP:
        pattern = re.compile(
            r'([:=(\s"\'\}])' + re.escape(source_hex) + r'([\s"\'\);])',
            re.IGNORECASE
        )
        content = pattern.sub(lambda m: m.group(1) + target_hex + m.group(2), content)

    # 2. Broader Blue-ish Catch-all (for any remaining blues in fill/stroke)
    # This catches things like fill="#3498db" or stroke="#007bff"
    blue_pattern = re.compile(r'(fill|stroke)=["\']#(?:0[0-9a-fA-F]{2,5}|1[0-9a-fA-F]{2,5}|2[0-9a-fA-F]{2,5}|3[0-9a-fA-F]{2,5})["\']', re.IGNORECASE)
    content = blue_pattern.sub(r'\1="#006948"', content)

    if content != original_content:
        try:
            filepath.write_text(content, encoding="utf-8")
            return True
        except Exception as e:
            logger.error(f"  [ERROR] Could not write {filepath}: {e}")
            return False
    
    return False

def run():
    """
    Entry point for Frappe hooks (after_install / after_migrate).
    Scans and repaints all SVGs in installed apps.
    """
    logger.info("=" * 60)
    logger.info("Trevo SVG Repainter: Starting...")
    logger.info("=" * 60)

    bench_path = get_bench_path()
    apps_dir = bench_path / "apps"
    
    if not apps_dir.exists():
        logger.error(f"Apps directory not found at {apps_dir}")
        return

    modified_count = 0
    total_found = 0

    for app_dir in sorted(apps_dir.iterdir()):
        if not app_dir.is_dir() or app_dir.name in SKIP_APPS:
            continue
        
        logger.info(f"Scanning app: {app_dir.name}...")
        
        # We search the whole app directory recursively, but filtering out ignores
        for svg_file in app_dir.rglob("*.svg"):
            # Check if file is in an ignored directory
            rel_path = str(svg_file.relative_to(app_dir))
            if any(pat in rel_path for pat in IGNORE_PATTERNS):
                continue
            
            total_found += 1
            if repaint_file(svg_file):
                modified_count += 1
                logger.debug(f"  [PAINTED] {rel_path}")

    logger.info("=" * 60)
    logger.info(f"Summary: Found {total_found} SVGs, Repainted {modified_count} files.")
    logger.info("=" * 60)

if __name__ == "__main__":
    run()
