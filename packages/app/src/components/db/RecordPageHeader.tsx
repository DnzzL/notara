import type { DatabaseField, DatabaseRecord } from "@notara/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../rpc-client.js";
import { useDatabaseStore } from "../../stores/databaseStore.js";
import { RecordProperties } from "./RecordProperties.js";
import { ShortId } from "./ShortId.js";

/** What a record's full page shows of its record: short id and fields. */
export function RecordPageHeader({ recordId }: { recordId: string }) {
	const databases = useDatabaseStore((s) => s.databases);
	const [entry, setEntry] = useState<{
		record: DatabaseRecord;
		values: Record<string, unknown>;
	} | null>(null);
	const [fields, setFields] = useState<readonly DatabaseField[]>([]);
	const [related, setRelated] = useState<Record<string, any[]>>({});

	const load = useCallback(
		() =>
			api
				.getRecordWithValues({ recordId })
				.then(setEntry)
				.catch(() => setEntry(null)),
		[recordId],
	);

	useEffect(() => {
		setEntry(null);
		setFields([]);
		load();
	}, [load]);

	const databaseId = entry?.record.databaseId;
	useEffect(() => {
		if (!databaseId) return;
		api
			.listFields({ databaseId })
			.then(setFields)
			.catch(() => setFields([]));
	}, [databaseId]);

	// Records a relation field points to, so its chips show titles, not ids.
	useEffect(() => {
		for (const f of fields) {
			const target = f.relationTargetDbId;
			if (!target || related[target]) continue;
			api
				.listRecords({ databaseId: target })
				.then((recs) => setRelated((r) => ({ ...r, [target]: [...recs] })))
				.catch(() => {
					/* chips fall back to ids */
				});
		}
	}, [fields, related]);

	if (!entry) return null;
	return (
		<div className="mb-4">
			<ShortId id={entry.record.shortId} />
			{fields.length > 0 && (
				<div className="mt-2">
					<RecordProperties
						recordId={recordId}
						fields={fields}
						values={entry.values}
						databases={databases}
						allRecords={related}
						onChanged={load}
					/>
				</div>
			)}
		</div>
	);
}
