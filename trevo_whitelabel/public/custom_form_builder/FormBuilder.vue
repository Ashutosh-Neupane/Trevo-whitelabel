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

// ⌘S / Ctrl+S to save
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
		<div class="tv-builder-banner-bar d-flex justify-content-between align-items-center w-100 px-4 py-2 border-bottom">
			<div class="d-flex align-items-center gap-3">
				<div class="tv-builder-logo-shell">
					<div class="tv-builder-logo"></div>
				</div>
				<div>
					<div class="tv-builder-title">{{ __("Form Studio") }}</div>
					<div class="tv-builder-subtitle">{{ store.doctype || __("Drag, drop, and configure fields") }}</div>
				</div>
			</div>
			<div class="d-flex gap-2 align-items-center">
				<span v-if="store.dirty && !store.read_only" class="tv-unsaved-badge">
					<span class="tv-unsaved-dot"></span>{{ __("Unsaved") }}
				</span>
				<span v-else-if="!store.read_only" class="tv-saved-badge">
					{{ __("Saved") }}
				</span>
				<span class="tv-builder-badge">
					{{ store.read_only ? __("Read Only") : __("Interactive") }}
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

	.tv-builder-banner-bar {
		width: 100%;
		background: var(--tv-surface);
		border-color: var(--tv-line) !important;
		min-height: 52px;
	}

	.tv-builder-logo-shell {
		width: 32px;
		height: 32px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(107, 164, 75, 0.15) 0%, rgba(45, 122, 79, 0.18) 100%);
		border: 1px solid rgba(107, 164, 75, 0.2);
		flex-shrink: 0;
	}

	.tv-builder-logo {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		background: linear-gradient(135deg, var(--tv-primary) 0%, var(--tv-deep) 100%);
	}

	.tv-builder-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--tv-deep-900);
		font-family: var(--tv-font-sans);
		letter-spacing: -0.02em;
		line-height: 1.2;
	}

	.tv-builder-subtitle {
		font-size: 11px;
		color: var(--tv-text-3);
		font-family: var(--tv-font-sans);
		line-height: 1.2;
	}

	.tv-builder-badge {
		background: var(--tv-primary-50);
		color: var(--tv-primary-700);
		font-size: 11px;
		padding: 4px 9px;
		border-radius: var(--tv-r-pill);
		font-family: var(--tv-font-mono);
		border: 1px solid rgba(107, 164, 75, 0.18);
		font-weight: 600;
	}

	.tv-unsaved-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		font-weight: 600;
		color: var(--tv-warning);
		font-family: var(--tv-font-mono);
		padding: 4px 9px;
		border-radius: var(--tv-r-pill);
		background: var(--tv-warning-bg);
		border: 1px solid rgba(201, 138, 28, 0.2);
	}

	.tv-unsaved-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--tv-warning);
		animation: tv-pulse 1.4s ease infinite;
	}

	@keyframes tv-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.tv-saved-badge {
		font-size: 11px;
		font-weight: 600;
		color: var(--tv-success);
		font-family: var(--tv-font-mono);
		padding: 4px 9px;
		border-radius: var(--tv-r-pill);
		background: var(--tv-success-bg);
		border: 1px solid rgba(79, 156, 74, 0.2);
	}

	.form-controls {
		position: relative;
	}

	.form-container {
		flex: 1;
		background-color: var(--tv-bg);
		min-width: 0;
	}

	.form-sidebar {
		border-left: 1px solid var(--tv-line);
		border-bottom-right-radius: var(--border-radius);
	}

	.form-main {
		border-radius: var(--tv-r-3);
		border: 1px solid var(--tv-line);
		background-color: var(--tv-surface);
		margin: 8px;
		background-image: radial-gradient(rgba(107, 164, 75, 0.07) 1.5px, transparent 1.5px);
		background-size: 20px 20px;
	}
}
</style>
