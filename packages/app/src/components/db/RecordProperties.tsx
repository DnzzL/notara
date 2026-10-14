import { useState } from "react";
import { api } from "../../rpc-client.js";
import { CellDisplay, InlineCellEditor } from "./CellComponents.js";

/** A record's fields, each edited in place: the side panel and the record's page. */
export function RecordProperties({
	recordId,
	fields,
	values,
	databases,
	allRecords,
	onChanged,
}: {
	recordId: string;
	values: Record<string, unknown>;
	fields: ReadonlyArray<{
		id: string;
		name: string;
		type: string;
		options?: readonly string[] | null;
		relationTargetDbId?: string | null;
	}>;
	databases: any[];
	allRecords: Record<string, any[]>;
	onChanged: () => Promise<void> | void;
}) {
	const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

	const setFieldValue = async (fieldId: string, value: string) => {
		await api.updateFieldValue({ recordId, fieldId, value });
		setEditingFieldId(null);
		await onChanged();
	};

	return (
		<section className="grid grid-cols-[130px_1fr] gap-y-1.5 gap-x-3 items-start mb-6">
			{fields.map((field) => {
				const val = values[field.name] ?? "";
				const isEditing = editingFieldId === field.id;
				return (
					<div key={field.id} className="contents">
						<div className="text-text-3 text-[12.5px] pt-[7px]">
							{field.name}
						</div>
						<div className="record-panel-prop-value relative min-h-[28px]">
							{isEditing ? (
								<InlineCellEditor
									field={field as any}
									value={val}
									onSave={(v) => setFieldValue(field.id, v)}
									onCancel={() => setEditingFieldId(null)}
									allRecords={allRecords}
								/>
							) : (
								<div
									className="px-[7px] py-1 rounded cursor-pointer min-h-[24px] pointer-coarse:min-h-11 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:bg-surface-2 text-text-2 transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
									onClick={() => setEditingFieldId(field.id)}
								>
									<CellDisplay
										field={field as any}
										value={val}
										databases={databases}
										allRecords={allRecords}
									/>
								</div>
							)}
						</div>
					</div>
				);
			})}
			{fields.length === 0 && (
				<div className="col-span-2 text-text-3 text-[13px] pt-2">
					No properties yet. Add one from the table header.
				</div>
			)}
		</section>
	);
}
