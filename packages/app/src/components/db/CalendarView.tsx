import { useState } from "react";
import { cn } from "../ui/cn.js";
import { useDatabaseStore } from "../../stores/databaseStore.js";
import { CellDisplay } from "./CellComponents.js";
import { ViewSwitcher } from "./ViewSwitcher.js";

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
  const updateView = useDatabaseStore((s) => s.updateView);
  const createDbRecord = useDatabaseStore((s) => s.createDbRecord);
  const updateFieldValue = useDatabaseStore((s) => s.updateFieldValue);
  const loadDbRecords = useDatabaseStore((s) => s.loadDbRecords);
  const activeViewId = useDatabaseStore((s) => s.activeViewIdByDb[database.id] ?? null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [dateFieldId, setDateFieldId] = useState<string | null>(null);

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

  const handleAddOnDay = async (day: Date) => {
    const title = prompt("New record title:");
    if (!title?.trim()) return;
    const record = await createDbRecord(database.id, title.trim());
    if (dateField) {
      await updateFieldValue(record.id, dateField.id, toLocalDateStr(day));
    }
    await loadDbRecords(database.id);
  };

  const switchView = (v: ViewType) => {
    onChangeView(v);
    localStorage.setItem(`db-view:${database.id}`, JSON.stringify({ viewType: v }));
    if (activeViewId) updateView(activeViewId, { type: v });
  };

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
                      onClick={() => handleAddOnDay(day)}
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
    </div>
  );
}
