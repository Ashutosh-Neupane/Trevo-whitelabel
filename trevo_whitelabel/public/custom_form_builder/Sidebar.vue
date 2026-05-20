<script setup>
import FieldProperties from "./FieldProperties.vue";
import { useStore } from "../store";
import { ref, computed, onMounted, onUnmounted } from "vue";

let store = useStore();

let sidebar_width = ref(272);
let sidebar_resizing = ref(false);

const MIN_WIDTH = 256;  // 16 * 16
const MAX_WIDTH = 384;  // 24 * 16
const DEFAULT_WIDTH = 272;

const field_count = computed(() => {
	let count = 0;
	store.form.layout?.tabs?.forEach(tab => {
		tab.sections?.forEach(section => {
			section.columns?.forEach(col => {
				count += col.fields?.length || 0;
			});
		});
	});
	return count;
});

const section_count = computed(() => {
	let count = 0;
	store.form.layout?.tabs?.forEach(tab => {
		count += tab.sections?.length || 0;
	});
	return count;
});

function start_resize(event) {
	event.preventDefault();
	sidebar_resizing.value = true;
	document.body.style.userSelect = 'none';
	document.body.style.cursor = 'col-resize';
	
	document.addEventListener("mousemove", resize);
	document.addEventListener("mouseup", stop_resize);
}

function resize(event) {
	if (!sidebar_resizing.value) return;
	
	let new_width = window.innerWidth - event.clientX - 90;
	new_width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, new_width));
	sidebar_width.value = new_width;
}

function stop_resize() {
	sidebar_resizing.value = false;
	document.body.style.userSelect = '';
	document.body.style.cursor = '';
	document.removeEventListener("mousemove", resize);
	document.removeEventListener("mouseup", stop_resize);
}

// Save width preference
function saveWidthPreference() {
	localStorage.setItem('form-builder-sidebar-width', sidebar_width.value);
}

function loadWidthPreference() {
	const saved = localStorage.getItem('form-builder-sidebar-width');
	if (saved) {
		const width = parseInt(saved, 10);
		if (!isNaN(width) && width >= MIN_WIDTH && width <= MAX_WIDTH) {
			sidebar_width.value = width;
		}
	}
}

// Handle keyboard shortcuts
function handleKeydown(event) {
	if (event.key === 'Delete' && store.form.selected_field && !store.read_only) {
		store.delete_selected_field();
		event.preventDefault();
	}
}

onMounted(() => {
	loadWidthPreference();
	document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
	document.removeEventListener('keydown', handleKeydown);
	stop_resize();
});
</script>

<template>
	<div class="sidebar-wrapper">
		<div 
			class="sidebar-resizer"
			:class="{ resizing: sidebar_resizing }"
			@mousedown="start_resize"
			@dblclick="sidebar_width = DEFAULT_WIDTH; saveWidthPreference()"
			role="separator"
			aria-label="Resize sidebar"
			tabindex="0"
		/>
		<aside 
			class="sidebar-container tv-sidebar" 
			:style="{ width: `${sidebar_width}px` }"
			:class="{ 'resizing': sidebar_resizing }"
		>
			<FieldProperties v-if="store.form.selected_field" />
			<div class="default-state" v-else>
				<div class="sidebar-top-bar" v-if="!store.read_only">
					<div class="top-bar-left">
						<span class="panel-label">{{ __("Studio") }}</span>
						<div class="sidebar-stats">
							<div class="stat-chip" :title="__('Fields in form')">
								<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<rect x="2" y="3" width="12" height="2" rx="1"/>
									<rect x="2" y="7" width="8" height="2" rx="1"/>
									<rect x="2" y="11" width="10" height="2" rx="1"/>
								</svg>
								<span>{{ field_count }}</span>
							</div>
							<div class="stat-chip" :title="__('Sections')">
								<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<rect x="2" y="2" width="12" height="5" rx="1"/>
									<rect x="2" y="9" width="12" height="5" rx="1"/>
								</svg>
								<span>{{ section_count }}</span>
							</div>
						</div>
					</div>
					<button
						v-if="store.form.layout.tabs.length == 1"
						class="new-tab-btn btn btn-default btn-xs"
						:title="__('Add new tab')"
						@click="store.add_new_tab"
						aria-label="Add new tab"
					>
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M8 3v10M3 8h10"/>
						</svg>
						<span>{{ __("Tab") }}</span>
					</button>
				</div>
				
				<div class="empty-state">
					<div class="empty-state-icon" aria-hidden="true">✦</div>
					<h3 class="empty-state-title">{{ __("Nothing selected") }}</h3>
					<p class="empty-state-copy">
						{{ __("Click a field, section, or column on the canvas to edit its properties.") }}
					</p>
					<div class="empty-state-hints">
						<div class="hint-chip">
							<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor">
								<path d="M2 8h12M8 2v12"/>
							</svg>
							<span>{{ __("Drag to reorder") }}</span>
						</div>
						<div class="hint-chip">
							<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor">
								<circle cx="8" cy="8" r="6"/>
							</svg>
							<span>{{ __("Click to edit") }}</span>
						</div>
						<div class="hint-chip">
							<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor">
								<path d="M4 4h8v8H4z"/>
							</svg>
							<span>⌫ {{ __("Delete") }}</span>
						</div>
					</div>
				</div>
				
				<div class="sidebar-footer-tip" v-if="!store.read_only">
					<div class="tip-content">
						<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
							<circle cx="8" cy="8" r="6"/>
							<path d="M8 7v4M8 5.5v.5"/>
						</svg>
						<span>{{ __("⌘S to save · ⌫ to delete selected") }}</span>
					</div>
					<button 
						class="reset-width-btn"
						@click="sidebar_width = DEFAULT_WIDTH; saveWidthPreference()"
						:title="__('Reset sidebar width')"
						aria-label="Reset sidebar width"
					>
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor">
							<path d="M2 8h12M8 2v12"/>
						</svg>
					</button>
				</div>
			</div>
		</aside>
	</div>
</template>

<style lang="scss" scoped>
.sidebar-wrapper {
	position: relative;
	height: 100%;
}

.sidebar-resizer {
	position: absolute;
	top: 0;
	left: -4px;
	width: 8px;
	height: 100%;
	background: transparent;
	transition: all 0.2s ease;
	z-index: 10;
	cursor: col-resize;
	
	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 2px;
		height: 100%;
		background: var(--tv-primary-300);
		opacity: 0;
		transition: opacity 0.2s ease;
	}
	
	&:hover::before {
		opacity: 0.5;
	}
	
	&.resizing::before {
		opacity: 1;
	}
	
	&:focus-visible {
		outline: 2px solid var(--tv-primary-500);
		outline-offset: -2px;
	}
}

.sidebar-container {
	height: 100%;
	background: var(--tv-bg-2);
	border-left: 1px solid var(--tv-line);
	transition: width 0.1s ease;
	
	&.resizing {
		transition: none;
	}
}

.default-state {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
}

.sidebar-top-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 16px;
	border-bottom: 1px solid var(--tv-line);
	background: var(--tv-bg-2);
	flex-shrink: 0;
}

.top-bar-left {
	display: flex;
	align-items: center;
	gap: 12px;
	flex: 1;
	min-width: 0;
}

.panel-label {
	font-size: 11px;
	font-weight: 700;
	color: var(--tv-text-2);
	text-transform: uppercase;
	letter-spacing: 0.06em;
	white-space: nowrap;
}

.sidebar-stats {
	display: flex;
	gap: 6px;
}

.stat-chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px;
	border-radius: var(--tv-r-pill);
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);
	color: var(--tv-text-2);
	font-size: 11px;
	font-weight: 600;
	font-family: var(--tv-font-mono);
	cursor: default;
	transition: all 0.1s ease;
	
	svg { 
		stroke: var(--tv-text-3); 
		flex-shrink: 0; 
	}
	
	span {
		font-weight: 700;
		color: var(--tv-text-1);
	}
}

.new-tab-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 10px;
	border-radius: var(--tv-r-2);
	border: 1px solid var(--tv-line);
	background: var(--tv-surface);
	color: var(--tv-text-2);
	font-size: 11px;
	font-weight: 600;
	white-space: nowrap;
	transition: all 0.1s ease;
	
	svg {
		stroke: currentColor;
	}
	
	&:hover {
		background: var(--tv-primary-50);
		border-color: var(--tv-primary-300);
		color: var(--tv-primary-700);
	}
	
	&:active {
		transform: scale(0.96);
	}
}

.empty-state {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	text-align: center;
	gap: 12px;
	padding: 32px 20px;
	overflow-y: auto;
}

.empty-state-icon {
	font-size: 32px;
	color: var(--tv-primary-400);
	line-height: 1;
	opacity: 0.8;
}

.empty-state-title {
	font-size: 15px;
	font-weight: 600;
	color: var(--tv-deep-900);
	margin: 0;
}

.empty-state-copy {
	max-width: 240px;
	color: var(--tv-text-3);
	font-size: 12px;
	line-height: 1.5;
	margin: 0;
}

.empty-state-hints {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 8px;
	margin-top: 8px;
}

.hint-chip {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 5px 10px;
	border-radius: var(--tv-r-pill);
	border: 1px solid var(--tv-line);
	background: var(--tv-bg);
	color: var(--tv-text-2);
	font-size: 11px;
	font-weight: 500;
	font-family: var(--tv-font-mono);
	transition: all 0.1s ease;
	
	svg {
		stroke: var(--tv-text-3);
		opacity: 0.7;
	}
	
	&:hover {
		background: var(--tv-surface);
		border-color: var(--tv-primary-300);
	}
}

.sidebar-footer-tip {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 16px;
	border-top: 1px solid var(--tv-line-2);
	background: var(--tv-bg-2);
	flex-shrink: 0;
	
	.tip-content {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--tv-text-3);
		font-size: 11px;
		font-family: var(--tv-font-mono);
		
		svg { 
			stroke: var(--tv-text-3); 
			flex-shrink: 0; 
		}
	}
}

.reset-width-btn {
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
	
	svg {
		stroke: currentColor;
		width: 10px;
		height: 10px;
	}
	
	&:hover {
		background: var(--tv-primary-50);
		border-color: var(--tv-primary-300);
		color: var(--tv-primary-600);
	}
	
	&:active {
		transform: scale(0.92);
	}
}

// Scrollbar styling
.empty-state::-webkit-scrollbar {
	width: 6px;
}

.empty-state::-webkit-scrollbar-track {
	background: var(--tv-line-2);
	border-radius: 3px;
}

.empty-state::-webkit-scrollbar-thumb {
	background: var(--tv-text-3);
	border-radius: 3px;
	
	&:hover {
		background: var(--tv-text-2);
	}
}

// Responsive adjustments
@media (max-width: 768px) {
	.sidebar-container {
		position: absolute;
		right: 0;
		top: 0;
		z-index: 100;
		box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
	}
	
	.sidebar-resizer {
		display: none;
	}
}
</style>