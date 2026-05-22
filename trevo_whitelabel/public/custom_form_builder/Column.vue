<template>
	<div
		:class="['column tv-column-break', selected ? 'selected' : hovered ? 'hovered' : '']"
		:title="column.df.fieldname"
		@click.stop="store.form.selected_field = column.df"
		@mouseover.stop="hovered = true"
		@mouseout.stop="hovered = false"
	>
		<div
			v-if="column.df.label"
			class="column-header"
			:hidden="!column.df.label && store.read_only"
		>
			<div class="column-label">
				<span>{{ __(column.df.label) }}</span>
			</div>
		</div>
		<div v-if="column.df.description" class="column-description">
			{{ __(column.df.description) }}
		</div>
		<draggable
			class="column-container"
			v-model="column.fields"
			group="fields"
			:delay="is_touch_screen_device() ? 200 : 0"
			:animation="200"
			:easing="store.get_animation"
			item-key="id"
			:disabled="store.read_only"
			ghost-class="tv-drag-ghost"
			chosen-class="tv-drag-chosen"
		>
			<template #item="{ element }">
				<Field
					:column="column"
					:field="element"
					:data-is-user-generated="store.is_user_generated_field(element)"
				/>
			</template>
		</draggable>
		<div v-if="!column.fields.length" class="column-empty-state">
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v10M3 8h10"/></svg>
			<span>{{ __("Drop fields here") }}</span>
		</div>
		<div v-if="!column.fields.length && !store.read_only" class="empty-column" style="margin-top: auto; padding-top: 6px;">
			<AddFieldButton :column="column" />
		</div>
		<div v-else-if="column.fields.length && !store.read_only" class="add-new-field-btn" style="padding-top: 4px;">
			<AddFieldButton :field="column.fields[column.fields.length - 1]" :column="column" />
		</div>
	</div>
</template>

<script setup>
import draggable from "vuedraggable";
import Field from "./Field.vue";
import AddFieldButton from "./AddFieldButton.vue";
import { computed, ref } from "vue";
import { useStore } from "../store";
import { is_touch_screen_device } from "../utils";

const props = defineProps(["section", "column"]);
const store = useStore();

const hovered = ref(false);
const selected = computed(() => store.selected(props.column.df.name));
</script>

<style lang="scss" scoped>
.column {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	background-color: var(--tv-bg);
	border-radius: var(--tv-r-3);
	border: 1.5px dashed var(--tv-line);
	padding: 8px;
	margin-left: 4px;
	margin-right: 4px;
	min-height: 120px;
	transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;

	&.hovered {
		border-color: var(--tv-primary-400);
		border-style: solid;
		background-color: rgba(107, 164, 75, 0.02);
	}

	&.selected {
		border-color: var(--tv-primary);
		border-style: solid;
		background-color: rgba(107, 164, 75, 0.04);
		box-shadow: 0 0 0 3px rgba(107, 164, 75, 0.1);
	}

	.column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 6px;
		padding-left: 2px;

		.column-label :deep(span) {
			font-weight: 600;
			font-size: 12px;
			color: var(--tv-text-2);
		}
	}

	.column-description {
		font-size: 11px;
		color: var(--tv-text-3);
		margin-bottom: 6px;
		padding-left: 2px;
	}
}

.column-empty-state {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	padding: 16px 10px;
	border-radius: var(--tv-r-2);
	background: rgba(107, 164, 75, 0.03);
	border: 1px dashed rgba(107, 164, 75, 0.2);
	margin-top: 4px;
	color: var(--tv-text-3);
	font-size: 11px;
	font-weight: 600;

	svg { stroke: var(--tv-primary-300); flex-shrink: 0; }
}

:deep(.tv-drag-ghost) {
	opacity: 0.4;
	background: var(--tv-primary-50) !important;
	border: 1px dashed var(--tv-primary) !important;
	border-radius: var(--tv-r-2) !important;
}

:deep(.tv-drag-chosen) {
	box-shadow: var(--tv-sh-2) !important;
	opacity: 0.9;
}
</style>
