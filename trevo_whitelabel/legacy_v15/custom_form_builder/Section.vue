<template>
	<div
		class="form-section-container tv-section-container"
		:style="{ borderBottom: props.section.df.hide_border ? 'none' : '' }"
	>
		<div
			:class="[
				'form-section tv-section-card',
				hovered ? 'hovered' : '',
				store.selected(section.df.name) ? 'selected' : '',
				section.df.css_class || '',
			]"
			:title="section.df.fieldname"
			@click.stop="select_section"
			@mouseover.stop="hovered = true"
			@mouseout.stop="hovered = false"
		>
			<!-- Section Header -->
			<div
				:class="[
					'section-header tv-section-header',
					section.df.label || section.df.collapsible ? 'has-label' : '',
					collapsed ? 'collapsed' : '',
				]"
				:hidden="!section.df.label && store.read_only"
			>
				<div class="section-label d-flex align-items-center gap-2">
					<EditableInput
						:text="section.df.label"
						:placeholder="__('Section Title')"
						v-model="section.df.label"
					/>
					<div
						v-if="section.df.collapsible"
						class="collapse-indicator"
						v-html="frappe.utils.icon(collapsed ? 'down' : 'up-line', 'sm')"
					></div>
				</div>

				<div class="section-header-right d-flex align-items-center gap-2">
					<SectionStats
						:field-count="section_field_count"
						:column-count="section.columns.length"
					/>
					<Dropdown v-if="!store.read_only" :options="options" @click.stop />
				</div>
			</div>

			<!-- Section Description -->
			<div v-if="section.df.description" class="section-description tv-section-desc">
				{{ section.df.description }}
			</div>

			<!-- Section Columns -->
			<div
				class="section-columns"
				:class="{
					hidden: section.df.collapsible && collapsed,
					'has-one-column': section.columns.length === 1,
				}"
			>
				<draggable
					class="section-columns-container"
					v-model="section.columns"
					group="columns"
					item-key="id"
					:delay="is_touch_screen_device() ? 200 : 0"
					:animation="200"
					:easing="store.get_animation"
					:disabled="store.read_only"
					ghost-class="tv-drag-ghost"
				>
					<template #item="{ element }">
						<Column
							:section="section"
							:column="element"
							:data-is-user-generated="store.is_user_generated_field(element)"
						/>
					</template>
				</draggable>
			</div>
		</div>
	</div>
</template>

<script setup>
import draggable from "vuedraggable";
import Column from "./Column.vue";
import EditableInput from "./EditableInput.vue";
import Dropdown from "./Dropdown.vue";
import SectionStats from "./SectionStats.vue";
import { ref, computed } from "vue";
import { useStore } from "../store";
import {
	section_boilerplate,
	move_children_to_parent,
	confirm_dialog,
	is_touch_screen_device,
} from "../utils";
import { useMagicKeys, whenever } from "@vueuse/core";

const props = defineProps(["tab", "section"]);
const store = useStore();

const { Backspace } = useMagicKeys();
whenever(Backspace, (value) => {
	if (value && selected.value && store.not_using_input) {
		remove_section();
	}
});

const hovered = ref(false);
const collapsed = ref(false);
const selected = computed(() => store.selected(props.section.df.name));
const column = computed(() => props.section.columns[props.section.columns.length - 1]);

const section_field_count = computed(() =>
	props.section.columns.reduce((sum, col) => sum + (col.fields?.length || 0), 0)
);

// ── Section actions ────────────────────────────────────────────
function set_section_preset(presetClass) {
	props.section.df.css_class = presetClass;
	store.dirty = true;
}

function add_section_below() {
	let index = props.tab.sections.indexOf(props.section);
	props.tab.sections.splice(index + 1, 0, section_boilerplate());
}

function is_section_empty() {
	return !props.section.columns.some(
		(column) => (store.is_customize_form && !column.df.is_custom_field) || column.fields.length
	);
}

function remove_section() {
	if (store.is_customize_form && props.section.df.is_custom_field == 0) {
		frappe.msgprint(__("Cannot delete standard field. You can hide it if you want"));
		throw "cannot delete standard field";
	} else if (store.has_standard_field(props.section)) {
		delete_section();
	} else if (is_section_empty()) {
		delete_section(true);
	} else {
		confirm_dialog(
			__("Delete Section", null, "Title of confirmation dialog"),
			__(
				"Are you sure you want to delete the section? All the columns along with fields in the section will be moved to the previous section.",
				null,
				"Confirmation dialog message"
			),
			() => delete_section(),
			__("Delete section", null, "Button text"),
			() => delete_section(true),
			__("Delete entire section with fields", null, "Button text")
		);
	}
}

function delete_section(with_children) {
	let sections = props.tab.sections;
	let index = sections.indexOf(props.section);

	if (!with_children) {
		if (index > 0) {
			let prev_section = sections[index - 1];
			if (!is_section_empty()) {
				prev_section.columns = [...prev_section.columns, ...props.section.columns];
			}
		} else if (index == 0 && !is_section_empty()) {
			sections.unshift({
				df: store.get_df("Section Break"),
				columns: props.section.columns,
				is_first: true,
			});
			index++;
		}
	}

	sections.splice(index, 1);
	store.form.selected_field = null;
}

function select_section() {
	if (props.section.df.collapsible) {
		collapsed.value = !collapsed.value;
	}
	store.form.selected_field = props.section.df;
}

function move_sections_to_tab() {
	let new_tab = move_children_to_parent(props, "tab", "section", store.form.layout);
	store.form.active_tab = new_tab;
}

// ── Column actions ─────────────────────────────────────────────
function add_column() {
	props.section.columns.push({
		fields: [],
		df: store.get_df("Column Break"),
	});
}

function remove_column() {
	if (store.is_customize_form && column.value.df.is_custom_field == 0) {
		frappe.msgprint(__("Cannot delete standard field. You can hide it if you want"));
		throw "cannot delete standard field";
	} else if (column.value.fields.length == 0 || store.has_standard_field(column.value)) {
		delete_column();
	} else {
		confirm_dialog(
			__("Delete Column", null, "Title of confirmation dialog"),
			__(
				"Are you sure you want to delete the column? All the fields in the column will be moved to the previous column.",
				null,
				"Confirmation dialog message"
			),
			() => delete_column(),
			__("Delete column", null, "Button text"),
			() => delete_column(true),
			__("Delete entire column with fields", null, "Button text")
		);
	}
}

function delete_column(with_children) {
	let columns = props.section.columns;
	let index = columns.length - 1;

	if (with_children && index == 0 && columns.length == 1) {
		if (column.value.fields.length == 0) {
			frappe.msgprint(__("Section must have at least one column"));
			throw "section must have at least one column";
		}
		columns.unshift({
			df: store.get_df("Column Break"),
			fields: [],
			is_first: true,
		});
		index++;
	}

	if (!with_children) {
		if (index > 0) {
			let prev_column = columns[index - 1];
			prev_column.fields = [...prev_column.fields, ...column.value.fields];
		} else {
			if (column.value.fields.length == 0) {
				let next_column = columns[index + 1];
				if (next_column) {
					next_column.is_first = true;
				} else {
					frappe.msgprint(__("Section must have at least one column"));
					throw "section must have at least one column";
				}
			} else {
				columns.unshift({
					df: store.get_df("Column Break"),
					fields: column.value.fields,
					is_first: true,
				});
				index++;
			}
		}
	}

	columns.splice(index, 1);
	store.form.selected_field = null;
}

// ── Dropdown options ───────────────────────────────────────────
const options = computed(() => {
	let groups = [
		{
			group: __("Section"),
			items: [
				{ label: __("Add section below"), onClick: add_section_below },
				{ label: __("Remove section"), onClick: remove_section },
			],
		},
		{
			group: __("Column"),
			items: [{ label: __("Add column"), onClick: add_column }],
		},
		{
			group: __("Section Layout / Style Preset"),
			items: [
				{ label: __("Default Layout"), onClick: () => set_section_preset("") },
				{ label: __("Order Details Card"), onClick: () => set_section_preset("tv-section-details") },
				{ label: __("Items Breakdown Grid"), onClick: () => set_section_preset("tv-section-grid") },
				{ label: __("Summary Card"), onClick: () => set_section_preset("tv-section-summary") },
				{ label: __("Address & Contact Section"), onClick: () => set_section_preset("tv-section-address") },
				{ label: __("Hero Banner Section"), onClick: () => set_section_preset("tv-section-hero") },
				{ label: __("Two Columns (50/50)"), onClick: () => set_section_preset("tv-layout-half") },
				{ label: __("Three Columns (33/33/33)"), onClick: () => set_section_preset("tv-layout-third") },
				{ label: __("Four Columns (25/25/25/25)"), onClick: () => set_section_preset("tv-layout-fourth") },
				{ label: __("Sidebar Left (30/70)"), onClick: () => set_section_preset("tv-layout-sidebar-left") },
				{ label: __("Sidebar Right (70/30)"), onClick: () => set_section_preset("tv-layout-sidebar-right") },
				{ label: __("Compact Cards List"), onClick: () => set_section_preset("tv-layout-compact-cards") },
				{ label: __("Compact Grid Dashboard"), onClick: () => set_section_preset("tv-layout-dashboard-grid") },
				{ label: __("Feature Split (40/60)"), onClick: () => set_section_preset("tv-layout-feature-split") },
				{ label: __("Insight Rail (65/35)"), onClick: () => set_section_preset("tv-layout-insight-rail") },
				{ label: __("Metric Strip"), onClick: () => set_section_preset("tv-layout-metric-strip") },
				{ label: __("Soft Panel Section"), onClick: () => set_section_preset("tv-section-soft-panel") },
			]
		}
	];

	if (props.section.columns.length > 1) {
		groups[1].items.push({
			label: __("Remove column"),
			tooltip: __("Remove last column"),
			onClick: remove_column,
		});
	} else if (props.section.columns[0].fields.length) {
		groups[1].items.push({
			label: __("Empty column"),
			tooltip: __("Remove all fields in the column"),
			onClick: () => delete_column(true),
		});
	}

	if (props.tab.sections.indexOf(props.section) > 0) {
		groups[0].items.push({
			label: __("Move sections to new tab"),
			tooltip: __("Move current and all subsequent sections to a new tab"),
			onClick: move_sections_to_tab,
		});
	}

	return groups;
});
</script>

<style lang="scss" scoped>
.form-section-container {
	border-bottom: 1px solid var(--tv-line-2);
	background-color: var(--tv-surface);

	&:last-child { border-bottom: none; }
}

.form-section {
	background-color: inherit;
	border: 1px solid transparent;
	border-radius: var(--tv-r-3);
	padding: 12px 14px;
	cursor: pointer;
	transition: border-color 0.15s ease, box-shadow 0.15s ease;

	&.hovered { border-color: var(--tv-primary-300); }

	&.selected {
		border-color: var(--tv-primary);
		box-shadow: 0 0 0 3px rgba(107, 164, 75, 0.1);
	}
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding-bottom: 10px;

	&.collapsed { padding-bottom: 0; }

	.section-label {
		flex: 1;
		min-width: 0;

		:deep(span) {
			font-weight: 700;
			font-size: 13px;
			color: var(--tv-deep-900);
		}

		.collapse-indicator {
			display: inline-flex;
			align-items: center;
			color: var(--tv-primary);
		}
	}

	.section-header-right {
		flex-shrink: 0;
	}
}

.section-description {
	margin-bottom: 10px;
	font-size: 12px;
	color: var(--tv-text-3);
	font-family: var(--tv-font-sans);
	line-height: 1.5;
}

.section-columns-container {
	display: flex;
	min-height: 2rem;
	border-radius: var(--tv-r-2);
}

:deep(.tv-drag-ghost) {
	opacity: 0.35;
	background: var(--tv-primary-50) !important;
	border: 1px dashed var(--tv-primary) !important;
	border-radius: var(--tv-r-3) !important;
}
</style>
