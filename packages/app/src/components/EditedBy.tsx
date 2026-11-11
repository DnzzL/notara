import type { Page } from "@notara/shared";
import { useEffect, useState } from "react";
import { api, getCurrentWorkspaceId } from "../rpc-client.js";

/** Discreet "edited by X" line: the page's last editor (a person, or an API key by name). */
export function EditedBy({ page }: { page: Page }) {
	const [names, setNames] = useState<Record<string, string>>({});

	useEffect(() => {
		const workspaceId = getCurrentWorkspaceId();
		if (!workspaceId || page.updatedByKeyName) return;
		api
			.getWorkspaceMembers({ workspaceId })
			.then((members) =>
				setNames(Object.fromEntries(members.map((m) => [m.userId, m.name]))),
			)
			.catch(() => {
				/* the line is a nicety; no name, no line */
			});
	}, [page.updatedByKeyName]);

	const who = page.updatedByKeyName
		? `${page.updatedByKeyName} (API key)`
		: page.updatedBy
			? names[page.updatedBy]
			: undefined;
	if (!who) return null;
	return <p className="text-[12px] text-text-3 mt-1 mb-2">Edited by {who}</p>;
}
