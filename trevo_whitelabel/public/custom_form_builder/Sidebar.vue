<script setup>
import FieldProperties from "./FieldProperties.vue";
import { useStore } from "../store";
import { ref, computed, onMounted, onUnmounted } from "vue";

let store = useStore();

let sidebar_width = ref(280);
let sidebar_resizing = ref(false);
let active_panel = ref("add"); // "add" | "settings"

const MIN_W = 240;
const MAX_W = 420;
const DEFAULT_W = 280;
const STORAGE_KEY = "tv-fb-sidebar-w";

/* ── Stats ─────────────────────────────────────────────────── */
const field_count = computed(() => {
	let n = 0;
	store.form.layout?.tabs?.forEach(t =>
		t.sections?.forEach(s =>
			s.columns?.forEach(c => { n += c.fields?.length || 0; })
		)
	);
	return n;
});

const section_count = computed(() => {
	let n = 0;
	store.form.layout?.tabs?.forEach(t => { n += t.sections?.length || 0; });
	return n;
});

/* ── Resize ─────────────────────────────────────────────────── */
function start_resize(e) {
	e.preventDefault();
	sidebar_resizing.value = true;
	document.body.style.userSelect = "none";
	document.body.style.cursor = "col-resize";
	document.addEventListener("mousemove", on_resize);
	document.addEventListener("mouseup", stop_resize);
}

function on_resize(e) {
	if (!sidebar_resizing.value) return;
	let w = e.clientX - document.querySelector(".tv-fb-sidebar-slot")?.getBoundingClientRect().left || DEFAULT_W;
	sidebar_width.value = Math.max(MIN_W, Math.min(MAX_W, w));
}

function stop_resize() {
	sidebar_resizing.value = false;
	document.body.style.userSelect = "";
	document.body.style.cursor = "";
	localStorage.setItem(STORAGE_KEY, sidebar_width.value);
	document.removeEventListener("mousemove", on_resize);
	document.removeEventListener("mouseup", stop_resize);
}

/* ── Keyboard ───────────────────────────────────────────────── */
function handleKeydown(e) {
	if (e.key === "Delete" && store.form.selected_field && !store.read_only) {
		store.delete_selected_field?.();
		e.preventDefault();
	}
}

onMounted(() => {
	const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
	if (saved && saved >= MIN_W && saved <= MAX_W) sidebar_width.value = saved;
	document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
	document.removeEventListener("keydown", handleKeydown);
	stop_resize();
});
</script>

<template>
	<div
		class="tv-sb"
		:style="{ width: sidebar_width + 'px' }"
		:class="{ 'tv-sb--resizing': sidebar_resizing }"
	>
		<!-- Resize handle on right edge -->
		<div
			class="tv-sb-resizer"
			:class="{ active: sidebar_resizing }"
			@mousedown="start_resize"
			@dblclick="sidebar_width = DEFAULT_W; localStorage.setItem(STORAGE_KEY, DEFAULT_W)"
			role="separator"
			aria-label="Resize sidebar"
		></div>

		<!-- Field selected → properties -->
		<FieldProperties v-if="store.form.selected_field" />

		<!-- Default state -->
		<div v-else class="tv-sb-default">

			<!-- Panel tabs: Add Fields / Settings -->
			<div class="tv-sb-tabs" v-if="!store.read_only">
				<button
					class="tv-sb-tab"
					:class="{ active: active_panel === 'add' }"
					@click="active_panel = 'add'"
				>
					<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2">
						<path d="M8 3v10M3 8h10"/>
					</svg>
					{{ __("Add Fields") }}
				</button>
				<button
					class="tv-sb-tab"
					:class="{ active: active_panel === 'settings' }"
					@click="active_panel = 'settings'"
				>
					<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="2" y="2" width="12" height="5" rx="1"/>
						<rect x="2" y="9" width="12" height="5" rx="1"/>
					</svg>
					{{ __("Structure") }}
				</button>
			</div>

			<!-- Add Fields panel -->
			<div v-if="active_panel === 'add' && !store.read_only" class="tv-sb-panel">
				<div class="tv-sb-stats">
					<span class="tv-sb-stat" :title="__('Fields')">
						<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="2" y="3" width="12" height="2" rx="1"/>
							<rect x="2" y="7" width="8" height="2" rx="1"/>
							<rect x="2" y="11" width="10" height="2" rx="1"/>
						</svg>
						{{ field_count }} {{ __("fields") }}
					</span>
					<span class="tv-sb-stat" :title="__('Sections')">
						<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="2" y="2" width="12" height="5" rx="1"/>
							<rect x="2" y="9" width="12" height="5" rx="1"/>
						</svg>
						{{ section_count }} {{ __("sections") }}
					</span>
				</div>

				<!-- Add tab button -->
				<button
					v-if="store.form.layout?.tabs?.length === 1"
					class="tv-sb-action-btn"
					@click="store.add_new_tab"
				>
					<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2">
						<path d="M8 3v10M3 8h10"/>
					</svg>
					{{ __("Add Tab") }}
				</button>

				<!-- Hint: click fields in canvas to add -->
				<div class="tv-sb-hint-box">
					<div class="tv-sb-hint-icon" aria-hidden="true">
						<svg width="28" height="28" viewBox="0 0 32 32" fill="none">
							<rect x="4" y="4" width="11" height="11" rx="2.5"
								fill="rgba(107,164,75,0.12)"
								stroke="rgba(107,164,75,0.4)" stroke-width="1.2"/>
							<rect x="17" y="4" width="11" height="11" rx="2.5"
								fill="rgba(107,164,75,0.06)"
								stroke="rgba(107,164,75,0.22)" stroke-width="1.2"/>
							<rect x="4" y="17" width="11" height="11" rx="2.5"
								fill="rgba(107,164,75,0.06)"
								stroke="rgba(107,164,75,0.22)" stroke-width="1.2"/>
							<rect x="17" y="17" width="11" height="11" rx="2.5"
								fill="rgba(107,164,75,0.03)"
								stroke="rgba(107,164,75,0.12)" stroke-width="1.2"/>
						</svg>
					</div>
					<p class="tv-sb-hint-title">{{ __("Nothing selected") }}</p>
					<p class="tv-sb-hint-copy">{{ __("Click the + button inside any column on the canvas to add a field.") }}</p>
				</div>

				<!-- Keyboard shortcuts -->
				<div class="tv-sb-shortcuts">
					<div class="tv-sb-shortcut">
						<kbd>⌘S</kbd><span>{{ __("Save") }}</span>
					</div>
					<div class="tv-sb-shortcut">
						<kbd>⌫</kbd><span>{{ __("Delete selected") }}</span>
					</div>
					<div class="tv-sb-shortcut">
						<kbd>drag</kbd><span>{{ __("Reorder") }}</span>
					</div>
				</div>
			</div>

			<!-- Structure panel -->
			<div v-else-if="active_panel === 'settings' && !store.read_only" class="tv-sb-panel">
				<div class="tv-sb-section-label">{{ __("Form Structure") }}</div>
				<div class="tv-sb-tree">
					<div
						v-for="(tab, ti) in store.form.layout?.tabs"
						:key="ti"
						class="tv-sb-tree-tab"
					>
						<div class="tv-sb-tree-tab-label">
							<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="1" y="3" width="14" height="10" rx="1"/>
								<path d="M1 6h14"/>
							</svg>
							{{ tab.df.label || __("Tab") }}
							<span class="tv-sb-tree-count">{{ tab.sections?.length || 0 }}</span>
						</div>
						<div
							v-for="(sec, si) in tab.sections"
							:key="si"
							class="tv-sb-tree-section"
							@click.stop="store.form.selected_field = sec.df"
						>
							<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="2" y="2" width="12" height="12" rx="1"/>
							</svg>
							{{ sec.df.label || __("Section") }}
							<span class="tv-sb-tree-count">
								{{ sec.columns?.reduce((s, c) => s + (c.fields?.length || 0), 0) }}
							</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Read-only empty state -->
			<div v-if="store.read_only" class="tv-sb-panel tv-sb-panel--ro">
				<div class="tv-sb-hint-icon" aria-hidden="true">
					<svg width="28" height="28" viewBox="0 0 32 32" fill="none">
						<rect x="4" y="4" width="11" height="11" rx="2.5"
							fill="rgba(107,164,75,0.12)"
							stroke="rgba(107,164,75,0.4)" stroke-width="1.2"/>
						<rect x="17" y="4" width="11" height="11" rx="2.5"
							fill="rgba(107,164,75,0.06)"
							stroke="rgba(107,164,75,0.22)" stroke-width="1.2"/>
						<rect x="4" y="17" width="11" height="11" rx="2.5"
							fill="rgba(107,164,75,0.06)"
							stroke="rgba(107,164,75,0.22)" stroke-width="1.2"/>
						<rect x="17" y="17" width="11" height="11" rx="2.5"
							fill="rgba(107,164,75,0.03)"
							stroke="rgba(107,164,75,0.12)" stroke-width="1.2"/>
					</svg>
				</div>
				<p class="tv-sb-hint-title">{{ __("Read Only") }}</p>
				<p class="tv-sb-hint-copy">{{ __("This form is in read-only mode.") }}</p>
			</div>

			<!-- Footer -->
			<div class="tv-sb-footer" v-if="!store.read_only">
				<span class="tv-sb-footer-hint">⌘S · ⌫ · drag</span>
				<button
					class="tv-sb-reset-btn"
					@click="sidebar_width = DEFAULT_W; localStorage.setItem(STORAGE_KEY, DEFAULT_W)"
					:title="__('Reset width')"
				>
					<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 8a5 5 0 1 0 1-3"/>
						<path d="M3 3v2h2"/>
					</svg>
				</button>
			</div>
		</div>
	</div>
</template>

<style lang="scss" scoped>
/* ── Shell ───────────────────────────────────────────────────── */
.tv-sb {
	position: relative;
	height: 100%;
	background: var(--tv-bg-2);
	display: flex;
	flex-direction: column;
	overflow: hidden;
	transition: width 0.08s ease;

	&--resizing { transition: none; }
}

/* ── Resize handle ───────────────────────────────────────────── */
.tv-sb-resizer {
	position: absolute;
	top: 0;
	right: -5px;
	width: 10px;
	height: 100%;
	z-index: 10;
	cursor: col-resize;

	&::after {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 2px;
		height: 100%;
		background: var(--tv-primary);
		opacity: 0;
		border-radius: 1px;
		transition: opacity 0.15s ease;
	}

	&:hover::after, &.active::after { opacity: 0.45; }
}

/* ── Default layout ──────────────────────────────────────────── */
.tv-sb-default {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

/* ── Panel tabs ──────────────────────────────────────────────── */
.tv-sb-tabs {
	display: flex;
	border-bottom: 1px solid var(--tv-line);
	background: var(--tv-bg-2);
	flex-shrink: 0;
}

.tv-sb-tab {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	padding: 9px 8px;
	font-size: 11px;
	font-weight: 600;
	font-family: var(--tv-font-sans);
	color: var(--tv-text-3);
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	cursor: pointer;
	transition: color 0.12s ease, border-color 0.12s ease;

	svg { stroke: currentColor; flex-shrink: 0; }

	&.active {
		color: var(--tv-primary-700);
		border-bottom-color: var(--tv-primary);
	}

	&:hover:not(.active) { color: var(--tv-text-2); }
}

/* ── Panel content ───────────────────────────────────────────── */
.tv-sb-panel {
	flex: 1;
	overflow-y: auto;
	padding: 14px;
	display: flex;
	flex-direction: column;
	gap: 12px;

	&--ro {
		align-items: center;
		justify-content: center;
		text-align: center;
	}
}

/* ── Stats row ───────────────────────────────────────────────── */
.tv-sb-stats {
	display: flex;
	gap: 6px;
}

.tv-sb-stat {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 8px;
	border-radius: 20px;
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);
	color: var(--tv-primary-700);
	font-size: 10px;
	font-weight: 700;
	font-family: var(--tv-font-mono);
	cursor: default;

	svg { stroke: var(--tv-primary); flex-shrink: 0; }
}

/* ── Action button ───────────────────────────────────────────── */
.tv-sb-action-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	width: 100%;
	padding: 8px 12px;
	border-radius: var(--tv-r-2);
	border: 1px dashed var(--tv-primary-300);
	background: var(--tv-primary-50);
	color: var(--tv-primary-700);
	font-size: 12px;
	font-weight: 600;
	font-family: var(--tv-font-sans);
	cursor: pointer;
	transition: all 0.12s ease;

	svg { stroke: currentColor; }

	&:hover {
		background: var(--tv-primary-100);
		border-style: solid;
		border-color: var(--tv-primary);
	}
}

/* ── Hint box ────────────────────────────────────────────────── */
.tv-sb-hint-box {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	gap: 8px;
	padding: 16px 12px;
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);
	border-radius: var(--tv-r-3);
}

.tv-sb-hint-icon { opacity: 0.85; }

.tv-sb-hint-title {
	font-size: 13px;
	font-weight: 700;
	color: var(--tv-deep-900);
	margin: 0;
}

.tv-sb-hint-copy {
	font-size: 11px;
	color: var(--tv-text-3);
	line-height: 1.5;
	margin: 0;
}

/* ── Shortcuts ───────────────────────────────────────────────── */
.tv-sb-shortcuts {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.tv-sb-shortcut {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 5px 8px;
	border-radius: var(--tv-r-2);
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);

	kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		padding: 2px 5px;
		border-radius: 4px;
		background: var(--tv-bg);
		border: 1px solid var(--tv-line);
		color: var(--tv-primary-700);
		font-size: 10px;
		font-weight: 700;
		font-family: var(--tv-font-mono);
		box-shadow: 0 1px 0 var(--tv-line);
		flex-shrink: 0;
	}

	span {
		font-size: 11px;
		color: var(--tv-text-2);
		font-family: var(--tv-font-sans);
	}
}

/* ── Structure tree ──────────────────────────────────────────── */
.tv-sb-section-label {
	font-size: 10px;
	font-weight: 800;
	color: var(--tv-text-3);
	text-transform: uppercase;
	letter-spacing: 0.08em;
}

.tv-sb-tree {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.tv-sb-tree-tab {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.tv-sb-tree-tab-label {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 5px 8px;
	font-size: 11px;
	font-weight: 700;
	color: var(--tv-text-2);
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);
	border-radius: var(--tv-r-2);

	svg { stroke: var(--tv-primary); flex-shrink: 0; }
}

.tv-sb-tree-section {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px 4px 20px;
	font-size: 11px;
	color: var(--tv-text-3);
	border-radius: var(--tv-r-2);
	cursor: pointer;
	transition: background 0.1s ease, color 0.1s ease;

	svg { stroke: var(--tv-text-3); flex-shrink: 0; }

	&:hover {
		background: var(--tv-primary-50);
		color: var(--tv-primary-700);
		svg { stroke: var(--tv-primary); }
	}
}

.tv-sb-tree-count {
	margin-left: auto;
	font-size: 10px;
	font-family: var(--tv-font-mono);
	font-weight: 700;
	color: var(--tv-text-3);
	background: var(--tv-bg);
	border: 1px solid var(--tv-line);
	border-radius: 10px;
	padding: 1px 5px;
}

/* ── Footer ──────────────────────────────────────────────────── */
.tv-sb-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 14px;
	border-top: 1px solid var(--tv-line);
	background: var(--tv-bg-2);
	flex-shrink: 0;
}

.tv-sb-footer-hint {
	font-size: 10px;
	font-family: var(--tv-font-mono);
	color: var(--tv-text-3);
}

.tv-sb-reset-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	padding: 0;
	border-radius: var(--tv-r-2);
	border: 1px solid var(--tv-line);
	background: var(--tv-surface);
	color: var(--tv-text-3);
	cursor: pointer;
	transition: all 0.1s ease;

	svg { stroke: currentColor; }

	&:hover {
		background: var(--tv-primary-50);
		border-color: var(--tv-primary-300);
		color: var(--tv-primary);
	}
}

/* ── Scrollbar ───────────────────────────────────────────────── */
.tv-sb-panel::-webkit-scrollbar { width: 4px; }
.tv-sb-panel::-webkit-scrollbar-track { background: transparent; }
.tv-sb-panel::-webkit-scrollbar-thumb {
	background: var(--tv-line);
	border-radius: 2px;
}

/* ── Mobile ──────────────────────────────────────────────────── */
@media (max-width: 767px) {
	.tv-sb {
		width: 100% !important;
		height: auto;
		max-height: 280px;
	}
	.tv-sb-resizer { display: none; }
}
</style>
