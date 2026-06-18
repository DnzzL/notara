import { useDatabaseStore } from "../../stores/databaseStore.js";
import { cn } from "../ui/cn.js";
import { CellDisplay } from "./CellComponents.js";
import { ViewSwitcher } from "./ViewSwitcher.js";

type ViewType = "table" | "board" | "calendar" | "gallery";

export function GalleryView({
  database, fields, records, databases, onChangeView, allRecords = {}, onOpenRecord,
}: {
  database: any;
  fields: any[];
  records: any[];
  databases: any[];
  onChangeView: (v: ViewType) => void;
  allRecords?: Record<string, any[]>;
  onOpenRecord?: (record: any) => void;
}) {
  const updateView = useDatabaseStore((s) => s.updateView);
  const activeViewId = useDatabaseStore((s) => s.activeViewIdByDb[database.id] ?? null);

  const switchView = (v: ViewType) => {
    onChangeView(v);
    localStorage.setItem(`db-view:${database.id}`, JSON.stringify({ viewType: v }));
    if (activeViewId) updateView(activeViewId, { type: v });
  };

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex gap-1.5 mb-2.5 items-center flex-wrap py-1">
        <ViewSwitcher databaseId={database.id} currentViewType="gallery" />
        <div className="inline-flex bg-surface-3 border border-border rounded p-0.5" role="tablist">
          <button className={cn("bg-transparent border-none py-1 px-3 text-[12px] font-medium cursor-pointer rounded-[6px]", "text-text-3")} onClick={() => switchView("table")} role="tab" aria-selected={false}>Table</button>
          <button className={cn("bg-transparent border-none py-1 px-3 text-[12px] font-medium cursor-pointer rounded-[6px]", "text-text-3")} onClick={() => switchView("board")} role="tab" aria-selected={false}>Board</button>
          <button className={cn("bg-transparent border-none py-1 px-3 text-[12px] font-medium cursor-pointer rounded-[6px]", "text-text-3")} onClick={() => switchView("calendar")} role="tab" aria-selected={false}>Calendar</button>
          <button className={cn("bg-transparent border-none py-1 px-3 text-[12px] font-medium cursor-pointer rounded-[6px]", "bg-text text-bg")} role="tab" aria-selected={true}>Gallery</button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="bg-surface-2 rounded-[5px] p-8 text-center text-text-3 text-[14px]">
          No records yet.
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {records.map((r: any) => (
            <div
              key={r.record.id}
              className="group bg-surface border border-border rounded py-2.5 px-3 cursor-pointer transition-[border-color,box-shadow] duration-[var(--t)] ease-[var(--ease)] relative hover:border-[rgba(43,77,255,0.25)] hover:shadow-sm"
              onClick={() => onOpenRecord?.(r.record)}
            >
              <button
                className={cn("absolute top-1.5 right-1.5 bg-transparent border-none cursor-pointer text-text-3 px-1 py-0.5 text-[13px] leading-none rounded transition-[opacity,background] duration-[var(--t)] ease-[var(--ease)] z-[1] hover:bg-surface-3 hover:text-accent", r.record.pageId ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                onClick={(e) => { e.stopPropagation(); onOpenRecord?.(r.record); }}
                title={r.record.pageId ? "Open page" : "Open record"}
              >{r.record.pageId ? "📄" : "↗"}</button>
              <span className="text-[13.5px] font-medium text-text block leading-[1.45] pr-[22px]">{r.record.title || "Untitled"}</span>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {fields
                  .filter((f: any) => f.type !== "page")
                  .map((f: any) => {
                    const val = r.values[f.name];
                    if (!val && f.type !== "checkbox") return null;
                    return (
                      <div key={f.id} className="flex items-baseline gap-[5px] text-[12px]">
                        <span className="font-medium text-text-3 shrink-0">{f.name}</span>
                        <CellDisplay field={f} value={val} databases={databases} allRecords={allRecords} />
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
