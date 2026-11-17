<template>
	<div class="tv-section-stats">
		<span
			v-if="fieldCount > 0"
			class="tv-stat-chip"
			:title="__('Fields in section')"
		>
			<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="2" y="3" width="12" height="2" rx="1"/>
				<rect x="2" y="7" width="8" height="2" rx="1"/>
				<rect x="2" y="11" width="10" height="2" rx="1"/>
			</svg>
			{{ fieldCount }}
		</span>
		<span
			v-if="columnCount > 1"
			class="tv-stat-chip"
			:title="__('Columns')"
		>
			<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="1" y="2" width="6" height="12" rx="1"/>
				<rect x="9" y="2" width="6" height="12" rx="1"/>
			</svg>
			{{ columnCount }}
		</span>
	</div>
</template>

<script setup>
defineProps({
	fieldCount: { type: Number, default: 0 },
	columnCount: { type: Number, default: 1 },
});
</script>

<style lang="scss" scoped>
.tv-section-stats {
	display: flex;
	align-items: center;
	gap: 4px;
}

.tv-stat-chip {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	padding: 2px 6px;
	border-radius: var(--tv-r-pill);
	background: var(--tv-surface);
	border: 1px solid var(--tv-line);
	color: var(--tv-text-3);
	font-size: 10px;
	font-weight: 600;
	font-family: var(--tv-font-mono);
	cursor: default;
	line-height: 1.4;

	svg {
		stroke: var(--tv-text-3);
		flex-shrink: 0;
	}
}
</style>
