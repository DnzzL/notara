import {
	type Filter,
	type FilterOperator,
	OPERATOR_LABELS,
	operatorsForFieldType,
	type Sort,
} from "../../lib/filterEngine.js";
import { Button, IconButton, Input, Select } from "../ui/index.js";

// ── Filter Bar (type-aware) ─────────────────────────────────────────────────
//
// Operators and the value editor adapt to the selected column's type: selects
// offer their options, checkboxes a checked/unchecked toggle, numbers/dates
// their native inputs, everything else a free-text box.

const VALUELESS: FilterOperator[] = ["is_empty", "is_not_empty"];

function defaultValueForField(field: any): string {
	if (!field) return "";
	// The default a new filter starts with. Types whose cells are lists offer
	// their first option; a checkbox defaults to checked.
	if (field.type === "checkbox") return "true";
	if (field.type === "select" || field.type === "multiSelect")
		return field.options?.[0] ?? "";
	return "";
}

/** Build a new filter whose operator/value suit the field's type. */
export function makeDefaultFilter(field: any): Filter {
	return {
		fieldId: field?.id ?? "",
		operator: operatorsForFieldType(field?.type ?? "text")[0],
		value: defaultValueForField(field),
	};
}

function FilterValueInput({
	field,
	value,
	onChange,
}: {
	field: any;
	value: string;
	onChange: (v: string) => void;
}) {
	if (field?.type === "checkbox") {
		return (
			<Select
				name="filter-checkbox-value"
				value={value || "true"}
				onChange={(e) => onChange(e.target.value)}
				size="sm"
			>
				<option value="true">Checked</option>
				<option value="false">Unchecked</option>
			</Select>
		);
	}
	if (field && (field.type === "select" || field.type === "multiSelect")) {
		return (
			<Select
				name="filter-select-value"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				size="sm"
			>
				<option value="">Value</option>
				{(field.options || []).map((o: string) => (
					<option key={o} value={o}>
						{o}
					</option>
				))}
			</Select>
		);
	}
	if (field?.type === "number") {
		return (
			<Input
				name="filter-number-value"
				type="number"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Value"
				size="sm"
				className="w-20"
			/>
		);
	}
	if (field?.type === "date") {
		return (
			<Input
				name="filter-date-value"
				type="date"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				size="sm"
			/>
		);
	}
	return (
		<Input
			name="filter-text-value"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder="Value"
			size="sm"
			className="w-[100px]"
		/>
	);
}

export function FilterBar({
	fields,
	filters,
	onAdd,
	onRemove,
	onChange,
}: {
	fields: any[];
	filters: Filter[];
	onAdd: () => void;
	onRemove: (index: number) => void;
	onChange: (index: number, updates: Partial<Filter>) => void;
}) {
	if (filters.length === 0) {
		return (
			<Button onClick={onAdd} variant="ghost" size="sm">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M2 3h12M4 8h8M6 13h4"
						stroke="currentColor"
						strokeWidth="1.5"
						fill="none"
						strokeLinecap="round"
					/>
				</svg>
				Filter
			</Button>
		);
	}
	return (
		<div className="flex flex-wrap gap-2 items-center">
			<span
				style={{
					fontSize: 12,
					color: "var(--text-2)",
					fontWeight: 500,
					marginRight: 4,
				}}
			>
				Filter
			</span>
			{filters.map((filter, idx) => {
				const field = fields.find((f) => f.id === filter.fieldId);
				const operators = operatorsForFieldType(field?.type ?? "text");
				const showValue = !VALUELESS.includes(filter.operator);
				return (
					<div
						key={`${filter.fieldId}-${idx}`}
						className="flex gap-1 items-center bg-surface-2 rounded py-1 px-2 border border-border"
					>
						<Select
							name="filter-field"
							value={filter.fieldId}
							onChange={(e) => {
								const next = fields.find((f) => f.id === e.target.value);
								const ops = operatorsForFieldType(next?.type ?? "text");
								onChange(idx, {
									fieldId: e.target.value,
									operator: ops[0],
									value: defaultValueForField(next),
								});
							}}
						>
							<option value="">Field</option>
							{fields.map((f) => (
								<option key={f.id} value={f.id}>
									{f.name}
								</option>
							))}
						</Select>
						<Select
							name="filter-operator"
							value={filter.operator}
							onChange={(e) =>
								onChange(idx, { operator: e.target.value as FilterOperator })
							}
						>
							{operators.map((op) => (
								<option key={op} value={op}>
									{OPERATOR_LABELS[op]}
								</option>
							))}
						</Select>
						{showValue && (
							<FilterValueInput
								field={field}
								value={filter.value}
								onChange={(v) => onChange(idx, { value: v })}
							/>
						)}
						<IconButton onClick={() => onRemove(idx)} aria-label="Remove">
							&times;
						</IconButton>
					</div>
				);
			})}
			<Button onClick={onAdd} variant="ghost" size="sm">
				+ Add filter
			</Button>
		</div>
	);
}

// ── Sort Bar ──────────────────────────────────────────────────────────────

export function SortBar({
	fields,
	sorts,
	onAdd,
	onRemove,
	onChange,
}: {
	fields: any[];
	sorts: Sort[];
	onAdd: () => void;
	onRemove: (index: number) => void;
	onChange: (index: number, updates: Partial<Sort>) => void;
}) {
	if (sorts.length === 0) {
		return (
			<Button onClick={onAdd} variant="ghost" size="sm">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path
						d="M4 3v10M4 3l-2 2M4 3l2 2M12 13V3M12 13l-2-2M12 13l2-2"
						stroke="currentColor"
						strokeWidth="1.5"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
				Sort
			</Button>
		);
	}
	return (
		<div className="flex flex-wrap gap-2 items-center">
			<span
				style={{
					fontSize: 12,
					color: "var(--text-2)",
					fontWeight: 500,
					marginRight: 4,
				}}
			>
				Sort
			</span>
			{sorts.map((sort, idx) => (
				<div
					key={`${sort.fieldId}-${idx}`}
					className="flex gap-1 items-center bg-surface-2 rounded py-1 px-2 border border-border"
				>
					<Select
						name="sort-field"
						value={sort.fieldId}
						onChange={(e) => onChange(idx, { fieldId: e.target.value })}
					>
						<option value="">Field</option>
						{fields.map((f) => (
							<option key={f.id} value={f.id}>
								{f.name}
							</option>
						))}
					</Select>
					<Select
						name="sort-direction"
						value={sort.direction}
						onChange={(e) =>
							onChange(idx, { direction: e.target.value as "asc" | "desc" })
						}
					>
						<option value="asc">Ascending</option>
						<option value="desc">Descending</option>
					</Select>
					<IconButton onClick={() => onRemove(idx)} aria-label="Remove">
						&times;
					</IconButton>
				</div>
			))}
			<Button onClick={onAdd} variant="ghost" size="sm">
				+ Add sort
			</Button>
		</div>
	);
}
