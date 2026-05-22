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
	ignore: [".combo-box-options", "#autocomplete-area"],
});

watch(
	() => store.form.layout,
	() => (store.dirty = true),
	{ deep: true }
);

function handleKeydown(e) {
	if ((e.metaKey || e.ctrlKey) && e.key === "s") {
		e.preventDefault();
		if (store.dirty && !store.read_only) store.save();
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
		class="tv-fb-root"
		@click="store.form.selected_field = null"
	>
		<!-- Top bar -->
		<header class="tv-fb-topbar">
			<div class="tv-fb-topbar-left">
				<div class="tv-fb-logo">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
						<rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
						<rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.6"/>
						<rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.6"/>
						<rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.3"/>
					</svg>
				</div>
				<span class="tv-fb-title">{{ __("Form Studio") }}</span>
				<span class="tv-fb-sep">/</span>
				<span class="tv-fb-doctype">{{ store.doctype || __("Untitled") }}</span>
			</div>

			<div class="tv-fb-topbar-center">
				<transition name="tv-fade">
					<span v-if="store.dirty && !store.read_only" class="tv-fb-badge tv-fb-badge--unsaved">
						<span class="tv-fb-dot tv-fb-dot--blink"></span>
						{{ __("Unsaved") }}
					</span>
					<span v-else-if="!store.read_only" class="tv-fb-badge tv-fb-badge--saved">
						<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M3 8l4 4 6-6"/>
						</svg>
						{{ __("Saved") }}
					</span>
				</transition>
			</div>

			<div class="tv-fb-topbar-right">
				<button
					v-if="store.dirty && !store.read_only"
					class="tv-fb-save-btn"
					@click.stop="store.save()"
					:title="__('Save (⌘S)')"
				>
					<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M13 2H5L2 5v9h12V2z"/>
						<rect x="5" y="9" width="6" height="5"/>
						<rect x="6" y="2" width="4" height="3"/>
					</svg>
					{{ __("Save") }}
				</button>
				<span class="tv-fb-mode" :class="store.read_only ? 'tv-fb-mode--ro' : 'tv-fb-mode--edit'">
					<span class="tv-fb-dot"></span>
					{{ store.read_only ? __("Read Only") : __("Editing") }}
				</span>
			</div>
		</header>

		<!-- Body: sidebar + canvas -->
		<div class="tv-fb-body">
			<!-- Left sidebar -->
			<div class="tv-fb-sidebar-slot" @click.stop>
				<Sidebar />
			</div>

			<!-- Canvas — centered like forms_pro -->
			<main class="tv-fb-canvas">
				<div class="tv-fb-canvas-inner">
					<Tabs />
				</div>
			</main>
		</div>
	</div>
	<div id="autocomplete-area" />
</template>

<style lang="scss" scoped>
/* ── Root shell ──────────────────────────────────────────────── */
.tv-fb-root {
	margin: -15px -20px -5px;
	display: flex;
	flex-direction: column;
	min-height: calc(100vh - 60px);
	background: var(--tv-bg);
	overflow: hidden;
}

/* ── Topbar ──────────────────────────────────────────────────── */
.tv-fb-topbar {
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	align-items: center;
	padding: 0 16px;
	height: 52px;
	background: var(--tv-surface);
	border-bottom: 1px solid var(--tv-line);
	box-shadow: 0 1px 0 var(--tv-line), 0 2px 8px rgba(0,0,0,0.04);
	position: relative;
	z-index: 20;
	flex-shrink: 0;
}

.tv-fb-topbar-left {
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.tv-fb-logo {
	width: 28px;
	height: 28px;
	border-radius: 7px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, rgba(107,164,75,0.12), rgba(45,122,79,0.16));
	border: 1px solid rgba(107,164,75,0.22);
	color: var(--tv-primary);
	flex-shrink: 0;
}

.tv-fb-title {
	font-size: 13px;
	font-weight: 700;
	color: var(--tv-deep-900);
	font-family: var(--tv-font-sans);
	letter-spacing: -0.025em;
	white-space: nowrap;
}

.tv-fb-sep {
	color: var(--tv-line);
	font-size: 14px;
}

.tv-fb-doctype {
	font-size: 12px;
	font-weight: 500;
	color: var(--tv-text-2);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 200px;
}

.tv-fb-topbar-center {
	display: flex;
	justify-content: center;
	align-items: center;
}

.tv-fb-topbar-right {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
}

/* ── Status badges ───────────────────────────────────────────── */
.tv-fb-badge {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 11px;
	font-weight: 600;
	padding: 3px 9px;
	border-radius: 20px;
	font-family: var(--tv-font-mono);
	white-space: nowrap;

	&--unsaved {
		color: var(--tv-warning);
		background: var(--tv-warning-bg);
		border: 1px solid rgba(201,138,28,0.2);
	}

	&--saved {
		color: var(--tv-success);
		background: var(--tv-success-bg);
		border: 1px solid rgba(79,156,74,0.2);
		svg { stroke: var(--tv-success); }
	}
}

.tv-fb-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: currentColor;
	flex-shrink: 0;

	&--blink { animation: tv-blink 1.6s ease infinite; }
}

@keyframes tv-blink {
	0%, 100% { opacity: 1; }
	50%       { opacity: 0.2; }
}

/* ── Save button ─────────────────────────────────────────────── */
.tv-fb-save-btn {
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
	transition: background 0.12s ease, transform 0.1s ease;
	box-shadow: 0 1px 0 rgba(20,32,26,.1), inset 0 1px 0 rgba(255,255,255,.15);

	svg { stroke: #fff; flex-shrink: 0; }

	&:hover { background: var(--tv-primary-600); transform: translateY(-1px); }
	&:active { transform: translateY(0); }
}

/* ── Mode pill ───────────────────────────────────────────────── */
.tv-fb-mode {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 11px;
	font-weight: 600;
	padding: 3px 9px;
	border-radius: 20px;
	font-family: var(--tv-font-mono);
	white-space: nowrap;

	&--edit {
		color: var(--tv-primary-700);
		background: var(--tv-primary-50);
		border: 1px solid rgba(107,164,75,0.22);
		.tv-fb-dot { box-shadow: 0 0 0 2px rgba(107,164,75,0.25); }
	}

	&--ro {
		color: var(--tv-text-2);
		background: var(--tv-bg-2);
		border: 1px solid var(--tv-line);
	}
}

/* ── Body layout ─────────────────────────────────────────────── */
.tv-fb-body {
	display: flex;
	flex: 1;
	overflow: hidden;
	min-height: 0;
}

/* ── Left sidebar slot ───────────────────────────────────────── */
.tv-fb-sidebar-slot {
	flex-shrink: 0;
	border-right: 1px solid var(--tv-line);
	height: 100%;
	overflow: hidden;
	position: relative;
}

/* ── Canvas — centered, forms_pro style ──────────────────────── */
.tv-fb-canvas {
	flex: 1;
	overflow: auto;
	background: var(--tv-bg);
	/* Subtle dot grid */
	background-image: radial-gradient(
		rgba(107,164,75,0.07) 1.5px,
		transparent 1.5px
	);
	background-size: 22px 22px;
	display: flex;
	justify-content: center;
	padding: 24px 16px;
}

.tv-fb-canvas-inner {
	width: 100%;
	max-width: 860px;
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);
	border-radius: var(--tv-r-4);
	box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
	min-height: calc(100vh - 160px);
	overflow: hidden;
}

/* ── Fade transition ─────────────────────────────────────────── */
.tv-fade-enter-active,
.tv-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.tv-fade-enter-from   { opacity: 0; transform: translateY(-3px); }
.tv-fade-leave-to     { opacity: 0; transform: translateY(3px); }

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width: 900px) {
	.tv-fb-topbar {
		grid-template-columns: 1fr auto;
		.tv-fb-topbar-center { display: none; }
	}
}

@media (max-width: 767px) {
	.tv-fb-body { flex-direction: column; }

	.tv-fb-sidebar-slot {
		width: 100% !important;
		height: auto;
		border-right: none;
		border-bottom: 1px solid var(--tv-line);
		max-height: 280px;
		overflow-y: auto;
	}

	.tv-fb-canvas {
		padding: 12px 8px;
	}

	.tv-fb-canvas-inner {
		max-width: 100%;
		min-height: 400px;
	}

	.tv-fb-doctype { max-width: 100px; }
}
</style>
