/** A record's short id (`NOT-12`), shown ahead of its title. */
export function ShortId({ id }: { id: string }) {
	return (
		<span className="mr-1.5 text-text-3 text-[0.85em] font-normal font-mono select-all">
			{id}
		</span>
	);
}
