/**
 * Version, licence, and where to get the source.
 *
 * AGPL section 13: someone interacting with this instance over a network must
 * be able to get its source. The landing page links the repository, but a
 * logged-in user never sees the landing page — and on a modified instance the
 * operator owes users THEIR source, not upstream's, which is why the URL is
 * served by the instance rather than compiled in.
 *
 * This is a licence obligation rather than a nicety, so it does not hide behind
 * an admin check: any user of the instance is who the clause is about.
 */
import { useEffect, useState } from "react";
import { restCall } from "../lib/restClient.js";

type InstanceInfo = {
	version: string;
	licence: string;
	sourceUrl: string;
};

export function AboutPanel() {
	const [info, setInfo] = useState<InstanceInfo | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		restCall<InstanceInfo>("/api/public-config")
			.then(setInfo)
			.catch(() => setFailed(true));
	}, []);

	if (failed) {
		return (
			<p className="text-[13px] text-text-3">
				Could not read this instance's details. The source is at{" "}
				<a
					href="https://github.com/DnzzL/notara"
					target="_blank"
					rel="noreferrer"
					className="text-accent underline"
				>
					github.com/DnzzL/notara
				</a>
				, unless this instance has been modified.
			</p>
		);
	}

	if (!info) return <p className="text-[13px] text-text-3">Loading…</p>;

	const rows: Array<[string, React.ReactNode]> = [
		["Version", info.version],
		["Licence", info.licence],
		[
			"Source",
			<a
				key="source"
				href={info.sourceUrl}
				target="_blank"
				rel="noreferrer"
				className="text-accent underline break-all"
			>
				{info.sourceUrl}
			</a>,
		],
	];

	return (
		<section>
			<h3 className="text-[11.5px] font-semibold mb-2.5 text-text-3 uppercase tracking-[0.06em]">
				About this instance
			</h3>
			<dl className="text-[13px]">
				{rows.map(([label, value]) => (
					<div key={label} className="flex gap-3 py-1.5 border-b border-border">
						<dt className="w-24 shrink-0 text-text-3">{label}</dt>
						<dd className="text-text">{value}</dd>
					</div>
				))}
			</dl>
			<p className="text-[12px] text-text-3 mt-3">
				Notara is free software. You may run, study, modify and redistribute it.
				If you run a modified version and let others use it over a network, you
				have to offer them your source too — that is what the link above is for.
			</p>
		</section>
	);
}
