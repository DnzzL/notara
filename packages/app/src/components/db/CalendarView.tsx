import { useState } from "react";
import { cn } from "../ui/cn.js";
import { useDatabaseStore } from "../../stores/databaseStore.js";
import { CellDisplay } from "./CellComponents.js";
import { ViewSwitcher } from "./ViewSwitcher.js";
import {
  DialogRoot,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogTitle,
  DialogCloseTrigger,
} from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import { Button } from "../ui/index.js";

type ViewType = "table" | "board" | "calendar";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CalendarView({
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
  const createDbRecord = useDatabaseStore((s) => s.createDbRecord);
  const updateFieldValue = useDatabaseStore((s) => s.updateFieldValue);
  const loadDbRecords = useDatabaseStore((s) => s.loadDbRecords);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [dateFieldId, setDateFieldId] = useState<string | null>(null);
  const [addDay, setAddDay] = useState<Date | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const dateFields = fields.filter((f: any) => f.type === "date");
  const dateField = dateFieldId
    ? fields.find((f: any) => f.id === dateFieldId)
    : dateFields[0] || null;

  // Build the 42-cell grid (6 weeks)
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  // Index records by their local date string
  const byDay: Record<string, any[]> = {};
  if (dateField) {
    for (const r of records) {
      const raw: string = r.values[dateField.name] || "";
      if (!raw) continue;
      // Stored values may be ISO strings like "2025-06-18" or "2025-06-18T..."
      const prefix = raw.slice(0, 10);
      if (!byDay[prefix]) byDay[prefix] = [];
      byDay[prefix].push(r);
    }
  }

  const handlePrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const handleNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const submitAddRecord = async () => {
    const title = newTitle.trim();
    if (!title || !addDay) return;
    const day = addDay;
    setAddDay(null);
    setNewTitle("");
    const record = await createDbRecord(database.id, title);
    if (dateField) await updateFieldValue(record.id, dateField.id, toLocalDateStr(day));
    await loadDbRecords(database.id);
  };

  // Layout switching (incl. leaving any active saved view) is handled by the
  // parent's changeViewType; this just forwards the chosen layout.
  const switchView = (v: ViewType) => onChangeView(v);

  const todayStr = toLocalDateStr(now);

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex gap-1.5 mb-2.5 items-center flex-wrap py-1">
        <ViewSwitcher databaseId={database.id} currentViewType="calendar" />
        <div className="inline-flex bg-surface-3 border border-border rounded p-0.5" role="tablist">
          <button className={cn("bg-transparent border-none py-1 px-3 text-[12px] font-medium cursor-pointer rounded-[6px]", "text-text-3")} onClick={() => switchView("table")} role="tab" aria-selected={false}>Table</button>
          <button className={cn("bg-transparent border-none py-1 px-3 text-[12px] font-medium cursor-pointer rounded-[6px]", "text-text-3")} onClick={() => switchView("board")} role="tab" aria-selected={false}>Board</button>
          <button className={cn("bg-transparent border-none py-1 px-3 text-[12px] font-medium cursor-pointer rounded-[6px]", "bg-text text-bg")} role="tab" aria-selected={true}>Calendar</button>
        </div>

        {dateFields.length > 0 && (
          <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#666" }}>
            <span style={{ fontWeight: 500 }}>Date field:</span>
            <select
              name="calendar-date-field"
              value={dateField?.id || ""}
              onChange={(e) => setDateFieldId(e.target.value || null)}
              className="border border-border rounded-[5px] px-2 py-[3px] text-[13px] bg-surface text-text cursor-pointer [font-family:var(--font-ui)]"
            >
              {dateFields.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!dateField ? (
        <div className="bg-surface-2 rounded-[5px] p-8 text-center text-text-3 text-[14px]">
          Add a Date field to use the calendar view.
        </div>
      ) : (
        <>
          {/* Month navigation */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handlePrev}
              className="bg-transparent border border-border rounded-[5px] px-2 py-1 text-[13px] text-text-2 cursor-pointer transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
            >‹</button>
            <span className="text-[15px] font-semibold text-text min-w-[140px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button
              onClick={handleNext}
              className="bg-transparent border border-border rounded-[5px] px-2 py-1 text-[13px] text-text-2 cursor-pointer transition-[background,color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
            >›</button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-[11px] font-semibold text-text-3 text-center py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 border-l border-t border-border">
            {cells.map((day, i) => {
              const dayStr = toLocalDateStr(day);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = dayStr === todayStr;
              const dayRecords = byDay[dayStr] || [];

              return (
                <div
                  key={i}
                  className={cn(
                    "border-r border-b border-border min-h-[96px] p-1.5 relative group",
                    isCurrentMonth ? "bg-surface" : "bg-surface-2",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isToday ? "bg-text text-bg" : isCurrentMonth ? "text-text" : "text-text-3",
                    )}>
                      {day.getDate()}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 bg-transparent border-none cursor-pointer text-text-3 text-[16px] leading-none px-1 transition-[opacity,color] duration-[var(--t)] ease-[var(--ease)] hover:text-text"
                      onClick={() => { setAddDay(day); setNewTitle(""); }}
                      title="Add record"
                    >+</button>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayRecords.map((r: any) => (
                      <button
                        key={r.record.id}
                        onClick={() => onOpenRecord?.(r.record)}
                        className="w-full text-left bg-surface-3 border border-border rounded-[3px] px-1.5 py-0.5 text-[11.5px] text-text truncate cursor-pointer transition-[background,border-color] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-4 hover:border-border-mid"
                        title={r.record.title}
                      >
                        {r.record.title || "Untitled"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <DialogRoot
        open={addDay !== null}
        onOpenChange={(e) => { if (!e.open) { setAddDay(null); setNewTitle(""); } }}
        lazyMount
        unmountOnExit
      >
        <Portal>
          <DialogBackdrop className="fixed inset-0 bg-[rgba(15,18,30,0.4)] backdrop-blur-[6px] z-[1000] [animation:fade-in_0.14s_var(--ease)]" />
          <DialogPositioner className="fixed inset-0 z-[1001] flex items-center justify-center p-6">
            <DialogContent className="bg-surface border border-border-mid rounded-lg shadow-[var(--shadow-xl)] w-[380px] max-w-full overflow-hidden [animation:modal-pop_0.18s_var(--ease-spring)]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <DialogTitle className="text-[15px] font-semibold text-text">
                  New record{addDay ? ` — ${toLocalDateStr(addDay)}` : ""}
                </DialogTitle>
                <DialogCloseTrigger
                  className="bg-transparent border-none text-[17px] cursor-pointer text-text-3 p-1.5 rounded-[5px] transition-[all] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3 hover:text-text"
                  aria-label="Close"
                >
                  ✕
                </DialogCloseTrigger>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <input
                  name="new-record-title"
                  type="text"
                  placeholder="Record title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitAddRecord();
                  }}
                  autoFocus
                  className="w-full border border-border rounded-[5px] px-3 py-2 text-[14px] bg-surface text-text placeholder:text-text-3 outline-none focus:border-accent [font-family:var(--font-ui)]"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => { setAddDay(null); setNewTitle(""); }}>Cancel</Button>
                  <Button variant="primary" onClick={submitAddRecord} disabled={!newTitle.trim()}>Create</Button>
                </div>
              </div>
            </DialogContent>
          </DialogPositioner>
        </Portal>
      </DialogRoot>
    </div>
  );
}
