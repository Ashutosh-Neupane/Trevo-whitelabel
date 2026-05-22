<script setup>
import FieldProperties from "./FieldProperties.vue";
import { useStore } from "../store";
import { ref, computed, onMounted, onUnmounted } from "vue";

let store = useStore();

let sidebar_width = ref(272);
let sidebar_resizing = ref(false);

const MIN_WIDTH = 240;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 272;
const STORAGE_KEY = "tv-sidebar-width";

const field_count = computed(() => {
	let count = 0;
	store.form.layout?.tabs?.forEach(tab => {
		tab.sections?.forEach(section => {
			section.columns?.forEach(col => { count += col.fields?.length || 0; });
		});
	});
	return count;
});

const section_count = computed(() => {
	let count = 0;
	store.form.layout?.tabs?.forEach(tab => { count += tab.sections?.length || 0; });
	return count;
});

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
	let w = window.innerWidth - e.clientX;
	sidebar_width.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));
}

function stop_resize() {
	sidebar_resizing.value = false;
	document.body.style.userSelect = "";
	document.body.style.cursor = "";
	document.removeEventListener("mousemove", on_resize);
	document.removeEventListener("mouseup", stop_resize);
}

function reset_width() {
	sidebar_width.value = DEFAULT_WIDTH;
	localStorage.setItem(STORAGE_KEY, DEFAULT_WIDTH);
}

function handleKeydown(e) {
	if (e.key === "Delete" && store.form.selected_field && !store.read_only) {
		store.delete_selected_field?.();
		e.preventDefault();
	}
}

onMounted(() => {
	const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
	if (saved && saved >= MIN_WIDTH && saved <= MAX_WIDTH) sidebar_width.value = saved;
	document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
	document.removeEventListener("keydown", handleKeydown);
	stop_resize();
});
</script>

<template>
	<div class="tv-sidebar-wrap">
		<!-- Drag handle -->
		<div
			class="tv-resizer"
			:class="{ active: sidebar_resizing }"
			@mousedown="start_resize"
			@dblclick="reset_width"
			role="separator"
			aria-label="Resize sidebar"
			tabindex="0"
		>
			<span class="tv-resizer-line"></span>
		</div>

		<aside
			class="tv-sidebar"
			:style="{ width: sidebar_width + 'px' }"
			:class="{ resizing: sidebar_resizing }"
		>
			<!-- Field selected → properties panel -->
			<FieldProperties v-if="store.form.selected_field" />

			<!-- Default: nothing selected -->
			<div v-else class="tv-sidebar-default">

				<!-- Top bar -->
				<div class="tv-sidebar-topbar" v-if="!store.read_only">
					<div class="tv-sidebar-topbar-left">
						<span class="tv-sidebar-label">{{ __("Studio") }}</span>
						<div class="tv-sidebar-stats">
							<span class="tv-stat" :title="__('Total fields')">
								<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="2" y="3" width="12" height="2" rx="1"/>
									<rect x="2" y="7" width="8" height="2" rx="1"/>
									<rect x="2" y="11" width="10" height="2" rx="1"/>
								</svg>
								{{ field_count }}
							</span>
							<span class="tv-stat" :title="__('Sections')">
								<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="2" y="2" width="12" height="5" rx="1"/>
									<rect x="2" y="9" width="12" height="5" rx="1"/>
								</svg>
								{{ section_count }}
							</span>
						</div>
					</div>
					<button
						v-if="store.form.layout?.tabs?.length === 1"
						class="tv-add-tab-btn"
						@click="store.add_new_tab"
						:title="__('Add tab')"
					>
						<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M8 3v10M3 8h10"/>
						</svg>
						{{ __("Tab") }}
					</button>
				</div>

				<!-- Empty state -->
				<div class="tv-sidebar-empty">
					<div class="tv-empty-icon" aria-hidden="true">
						<svg width="36" height="36" viewBox="0 0 36 36" fill="none">
							<rect x="4" y="4" width="12" height="12" rx="3"
								fill="rgba(107,164,75,0.12)"
								stroke="rgba(107,164,75,0.4)" stroke-width="1.2"/>
							<rect x="20" y="4" width="12" height="12" rx="3"
								fill="rgba(107,164,75,0.06)"
								stroke="rgba(107,164,75,0.22)" stroke-width="1.2"/>
							<rect x="4" y="20" width="12" height="12" rx="3"
								fill="rgba(107,164,75,0.06)"
								stroke="rgba(107,164,75,0.22)" stroke-width="1.2"/>
							<rect x="20" y="20" width="12" height="12" rx="3"
								fill="rgba(107,164,75,0.03)"
								stroke="rgba(107,164,75,0.12)" stroke-width="1.2"/>
						</svg>
					</div>
					<h3 class="tv-empty-title">{{ __("Nothing selected") }}</h3>
					<p class="tv-empty-copy">{{ __("Click any field, section, or column to edit its properties.") }}</p>

					<div class="tv-hint-list">
						<div class="tv-hint-row">
							<kbd>drag</kbd>
							<span>{{ __("Reorder fields") }}</span>
						</div>
						<div class="tv-hint-row">
							<kbd>click</kbd>
							<span>{{ __("Edit properties") }}</span>
						</div>
						<div class="tv-hint-row">
							<kbd>⌫</kbd>
							<span>{{ __("Delete selected") }}</span>
						</div>
						<div class="tv-hint-row">
							<kbd>⌘S</kbd>
							<span>{{ __("Save") }}</span>
						</div>
					</div>
				</div>

				<!-- Footer -->
				<div class="tv-sidebar-footer" v-if="!store.read_only">
					<span class="tv-footer-hint">⌘S · ⌫ · drag</span>
					<button class="tv-reset-btn" @click="reset_width" :title="__('Reset sidebar width')">
						<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 8a5 5 0 1 0 1-3"/>
							<path d="M3 3v2h2"/>
						</svg>
					</button>
				</div>
			</div>
		</aside>
	</div>
</template>

<style lang="scss" scoped>
/* ── Wrapper ─────────────────────────────────────────────────── */
.tv-sidebar-wrap {
	position: relative;
	height: 100%;
	display: flex;
}

/* ── Resize handle ───────────────────────────────────────────── */
.tv-resizer {
	position: absolute;
	top: 0;
	left: -5px;
	width: 10px;
	height: 100%;
	z-index: 10;
	cursor: col-resize;
	display: flex;
	align-items: center;
	justify-content: center;

	.tv-resizer-line {
		width: 2px;
		height: 100%;
		background: var(--tv-primary);
		opacity: 0;
		border-radius: 1px;
		transition: opacity 0.15s ease;
	}

	&:hover .tv-resizer-line,
	&.active .tv-resizer-line { opacity: 0.45; }

	&:focus-visible {
		outline: 2px solid var(--tv-primary);
		outline-offset: -2px;
		border-radius: 2px;
	}
}

/* ── Sidebar shell ───────────────────────────────────────────── */
.tv-sidebar {
	height: 100%;
	background: var(--tv-bg-2);
	overflow: hidden;
	transition: width 0.08s ease;
	display: flex;
	flex-direction: column;

	&.resizing { transition: none; }
}

/* ── Default layout ──────────────────────────────────────────── */
.tv-sidebar-default {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

/* ── Top bar ─────────────────────────────────────────────────── */
.tv-sidebar-topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	border-bottom: 1px solid var(--tv-line);
	background: var(--tv-bg-2);
	flex-shrink: 0;
	gap: 8px;
}

.tv-sidebar-topbar-left {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 0;
}

.tv-sidebar-label {
	font-size: 10px;
	font-weight: 800;
	color: var(--tv-text-3);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	white-space: nowrap;
}

.tv-sidebar-stats {
	display: flex;
	gap: 4px;
}

.tv-stat {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 3px 7px;
	border-radius: 20px;
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);
	color: var(--tv-primary-700);
	font-size: 10px;
	font-weight: 700;
	font-family: var(--tv-font-mono);
	cursor: default;

	svg {
		stroke: var(--tv-primary);
		flex-shrink: 0;
	}
}

.tv-add-tab-btn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 4px 10px;
	border-radius: var(--tv-r-2);
	border: 1px solid var(--tv-line);
	background: var(--tv-surface);
	color: var(--tv-text-2);
	font-size: 11px;
	font-weight: 600;
	white-space: nowrap;
	cursor: pointer;
	transition: all 0.12s ease;

	svg { stroke: currentColor; }

	&:hover {
		background: var(--tv-primary-50);
		border-color: var(--tv-primary-300);
		color: var(--tv-primary-700);
		svg { stroke: var(--tv-primary); }
	}
	&:active { transform: scale(0.95); }
}

/* ── Empty state ─────────────────────────────────────────────── */
.tv-sidebar-empty {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	padding: 28px 18px;
	gap: 10px;
	overflow-y: auto;
}

.tv-empty-icon {
	opacity: 0.9;
	margin-bottom: 4px;
}

.tv-empty-title {
	font-size: 14px;
	font-weight: 700;
	color: var(--tv-deep-900);
	margin: 0;
	letter-spacing: -0.02em;
}

.tv-empty-copy {
	max-width: 210px;
	color: var(--tv-text-3);
	font-size: 12px;
	line-height: 1.55;
	margin: 0;
}

/* ── Hint list ───────────────────────────────────────────────── */
.tv-hint-list {
	margin-top: 10px;
	width: 100%;
	max-width: 210px;
	display: flex;
	flex-direction: column;
	gap: 5px;
}

.tv-hint-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 6px 10px;
	border-radius: var(--tv-r-2);
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);

	kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 30px;
		padding: 2px 5px;
		border-radius: 4px;
		background: var(--tv-bg);
		border: 1px solid var(--tv-line);
		color: var(--tv-primary-700);
		font-size: 10px;
		font-weight: 700;
		font-family: var(--tv-font-mono);
		flex-shrink: 0;
		box-shadow: 0 1px 0 var(--tv-line);
	}

	span {
		font-size: 11px;
		color: var(--tv-text-2);
		font-family: var(--tv-font-sans);
	}
}

/* ── Footer ──────────────────────────────────────────────────── */
.tv-sidebar-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 9px 14px;
	border-top: 1px solid var(--tv-line);
	background: var(--tv-bg-2);
	flex-shrink: 0;
}

.tv-footer-hint {
	font-size: 10px;
	font-family: var(--tv-font-mono);
	color: var(--tv-text-3);
}

.tv-reset-btn {
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
	&:active { transform: scale(0.9); }
}

/* ── Scrollbar ───────────────────────────────────────────────── */
.tv-sidebar-empty::-webkit-scrollbar { width: 4px; }
.tv-sidebar-empty::-webkit-scrollbar-track { background: transparent; }
.tv-sidebar-empty::-webkit-scrollbar-thumb {
	background: var(--tv-line);
	border-radius: 2px;
}

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width: 768px) {
	.tv-sidebar {
		position: absolute;
		right: 0;
		top: 0;
		z-index: 100;
		box-shadow: -4px 0 20px rgba(0,0,0,0.1);
	}
	.tv-resizer { display: none; }
}
</style>
