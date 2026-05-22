<script setup>
import Sidebar from "./components/Sidebar.vue";
import Tabs from "./components/Tabs.vue";
import { computed, onMounted, onUnmounted, watch, ref } from "vue";
import { useStore } from "./store";
import { onClickOutside } from "@vueuse/core";

let store = useStore();

let should_render = computed(() => {
	return Object.keys(store.form.layout).length !== 0;
});

let container = ref(null);
onClickOutside(container, () => (store.form.selected_field = null), {
	ignore: [".combo-box-options"],
});

watch(
	() => store.form.layout,
	() => (store.dirty = true),
	{ deep: true }
);

function handleKeydown(e) {
	if ((e.metaKey || e.ctrlKey) && e.key === "s") {
		e.preventDefault();
		if (store.dirty && !store.read_only) {
			store.save();
		}
	}
}

onMounted(() => {
	store.fetch();
	document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
	document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
	<div
		v-if="should_render"
		ref="container"
		class="form-builder-container tv-builder"
		@click="store.form.selected_field = null"
	>
		<div class="tv-builder-banner-bar">
			<div class="tv-banner-left">
				<div class="tv-builder-logo-shell">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
						<rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
						<rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.6"/>
						<rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.6"/>
						<rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.3"/>
					</svg>
				</div>
				<div class="tv-banner-identity">
					<span class="tv-banner-title">{{ __("Form Studio") }}</span>
					<span class="tv-banner-sep">/</span>
					<span class="tv-banner-doctype">{{ store.doctype || __("Untitled") }}</span>
				</div>
			</div>

			<div class="tv-banner-right">
				<transition name="tv-fade">
					<span v-if="store.dirty && !store.read_only" class="tv-status-pill tv-status-unsaved">
						<span class="tv-status-dot"></span>
						{{ __("Unsaved") }}
					</span>
					<span v-else-if="!store.read_only" class="tv-status-pill tv-status-saved">
						<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M3 8l4 4 6-6"/>
						</svg>
						{{ __("Saved") }}
					</span>
				</transition>

				<button
					v-if="store.dirty && !store.read_only"
					class="tv-save-btn"
					@click.stop="store.save()"
					:title="__('Save (⌘S)')"
				>
					<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M13 2H5L2 5v9h12V2z"/>
						<rect x="5" y="9" width="6" height="5"/>
						<rect x="6" y="2" width="4" height="3"/>
					</svg>
					{{ __("Save") }}
				</button>

				<span class="tv-mode-pill" :class="store.read_only ? 'read-only' : 'editing'">
					<span class="tv-mode-dot"></span>
					{{ store.read_only ? __("Read Only") : __("Editing") }}
				</span>
			</div>
		</div>

		<div class="form-container">
			<div class="form-main" :class="[store.preview ? 'preview' : '']">
				<Tabs />
			</div>
		</div>
		<div class="form-controls" @click.stop>
			<div class="form-sidebar">
				<Sidebar />
			</div>
		</div>
	</div>
	<div id="autocomplete-area" />
</template>

<style lang="scss" scoped>
.form-builder-container {
	margin: -15px -20px -5px;
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;

	&.resizing {
		user-select: none;
		cursor: col-resize;
	}
}

/* ── Banner bar ─────────────────────────────────────────────── */
.tv-builder-banner-bar {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 18px;
	min-height: 52px;
	background: var(--tv-surface);
	border-bottom: 1px solid var(--tv-line);
	box-shadow: 0 1px 0 var(--tv-line), 0 2px 8px rgba(0,0,0,0.04);
	gap: 12px;
	position: relative;
	z-index: 20;
}

.tv-banner-left {
	display: flex;
	align-items: center;
	gap: 10px;
	flex: 1;
	min-width: 0;
}

.tv-builder-logo-shell {
	width: 30px;
	height: 30px;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, rgba(107,164,75,0.12), rgba(45,122,79,0.16));
	border: 1px solid rgba(107,164,75,0.22);
	color: var(--tv-primary);
	flex-shrink: 0;
}

.tv-banner-identity {
	display: flex;
	align-items: baseline;
	gap: 7px;
	min-width: 0;
}

.tv-banner-title {
	font-size: 13px;
	font-weight: 700;
	color: var(--tv-deep-900);
	font-family: var(--tv-font-sans);
	letter-spacing: -0.025em;
	white-space: nowrap;
}

.tv-banner-sep {
	color: var(--tv-line);
	font-size: 15px;
	font-weight: 300;
}

.tv-banner-doctype {
	font-size: 12px;
	font-weight: 500;
	color: var(--tv-text-2);
	font-family: var(--tv-font-sans);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 220px;
}

.tv-banner-right {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

/* ── Status pills ───────────────────────────────────────────── */
.tv-status-pill {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 11px;
	font-weight: 600;
	padding: 4px 10px;
	border-radius: 20px;
	font-family: var(--tv-font-mono);
	white-space: nowrap;

	&.tv-status-unsaved {
		color: var(--tv-warning);
		background: var(--tv-warning-bg);
		border: 1px solid rgba(201,138,28,0.2);
	}

	&.tv-status-saved {
		color: var(--tv-success);
		background: var(--tv-success-bg);
		border: 1px solid rgba(79,156,74,0.2);
		svg { stroke: var(--tv-success); }
	}
}

.tv-status-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
	animation: tv-blink 1.6s ease infinite;
}

@keyframes tv-blink {
	0%, 100% { opacity: 1; }
	50%       { opacity: 0.25; }
}

/* ── Save button ────────────────────────────────────────────── */
.tv-save-btn {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 5px 12px;
	border-radius: var(--tv-r-2);
	border: 1px solid var(--tv-primary-600);
	background: var(--tv-primary);
	color: #fff;
	font-size: 12px;
	font-weight: 700;
	font-family: var(--tv-font-sans);
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.12s ease, transform 0.1s ease, box-shadow 0.12s ease;
	box-shadow: 0 1px 0 rgba(20,32,26,.1), inset 0 1px 0 rgba(255,255,255,.15);

	svg { stroke: #fff; flex-shrink: 0; }

	&:hover {
		background: var(--tv-primary-600);
		transform: translateY(-1px);
		box-shadow: 0 3px 8px rgba(107,164,75,.3);
	}
	&:active { transform: translateY(0); }
}

/* ── Mode pill ──────────────────────────────────────────────── */
.tv-mode-pill {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 11px;
	font-weight: 600;
	padding: 4px 10px;
	border-radius: 20px;
	font-family: var(--tv-font-mono);
	white-space: nowrap;

	&.editing {
		color: var(--tv-primary-700);
		background: var(--tv-primary-50);
		border: 1px solid rgba(107,164,75,0.22);
	}

	&.read-only {
		color: var(--tv-text-2);
		background: var(--tv-bg-2);
		border: 1px solid var(--tv-line);
	}
}

.tv-mode-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
	flex-shrink: 0;

	.editing & { box-shadow: 0 0 0 2px rgba(107,164,75,0.25); }
}

/* ── Fade transition ────────────────────────────────────────── */
.tv-fade-enter-active,
.tv-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.tv-fade-enter-from   { opacity: 0; transform: translateY(-3px); }
.tv-fade-leave-to     { opacity: 0; transform: translateY(3px); }

/* ── Canvas ─────────────────────────────────────────────────── */
.form-container {
	flex: 1;
	background: var(--tv-bg);
	min-width: 0;
	padding: 10px;
	background-image: radial-gradient(rgba(107,164,75,0.07) 1.5px, transparent 1.5px);
	background-size: 22px 22px;
}

.form-main {
	border-radius: var(--tv-r-3);
	border: 1px solid var(--tv-line);
	background: var(--tv-surface);
	min-height: calc(100vh - 120px);
	box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03);
	overflow: hidden;
}

/* ── Sidebar slot ───────────────────────────────────────────── */
.form-controls {
	position: relative;
}

.form-sidebar {
	border-left: 1px solid var(--tv-line);
	height: 100%;
}
</style>
