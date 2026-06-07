import { Tour, useTour, type TourStepDetails } from "@ark-ui/react";
import { useEffect, useRef } from "react";

const TOUR_COMPLETED_KEY = "notara:tourCompleted";

export function isTourCompleted(): boolean {
  try { return localStorage.getItem(TOUR_COMPLETED_KEY) === "true"; }
  catch { return true; }
}

function markTourCompleted() {
  try { localStorage.setItem(TOUR_COMPLETED_KEY, "true"); } catch {}
}

function resetTourCompleted() {
  try { localStorage.removeItem(TOUR_COMPLETED_KEY); } catch {}
}

const NEXT_PREV: TourStepDetails["actions"] = [
  { label: "Back", action: "prev" },
  { label: "Next", action: "next" },
];

const steps: TourStepDetails[] = [
  {
    id: "welcome", type: "dialog",
    title: "Welcome to Notara 👋",
    description: "Your private, source-available Notion. Local-first, single tier, yours to keep. Quick 4-step tour?",
    actions: [
      { label: "Skip", action: "dismiss" },
      { label: "Show me", action: "next" },
    ],
  },
  {
    id: "pages", type: "tooltip", placement: "right",
    target: () => document.querySelector<HTMLElement>("[data-sidebar]"),
    title: "Pages, nested any way you like",
    description: "Drag to reorder, nest pages inside pages, favorite the ones you live in.",
    actions: NEXT_PREV,
  },
  {
    id: "search", type: "tooltip", placement: "right",
    target: () => document.querySelector<HTMLElement>("[data-search-trigger]"),
    title: "⌘K finds anything",
    description: "Search every page and block content from anywhere — no mouse needed.",
    actions: NEXT_PREV,
  },
  {
    id: "new-page", type: "tooltip", placement: "right",
    target: () => document.querySelector<HTMLElement>("[data-new-page]"),
    title: "Templates ready to go",
    description: "Start blank, or pick a template — meeting notes, project plan, weekly review.",
    actions: NEXT_PREV,
  },
  {
    id: "editor", type: "tooltip", placement: "left",
    target: () => document.querySelector<HTMLElement>(".editor"),
    title: "Type / for anything",
    description: "Headings, to-dos, code, images, inline databases — all from the slash menu.",
    actions: [
      { label: "Back", action: "prev" },
      { label: "Got it", action: "next" },
    ],
  },
  {
    id: "end", type: "dialog",
    title: "You're set 🎉",
    description: "Open the Getting Started page in your sidebar for next steps. Retake this tour anytime from Settings.",
    actions: [{ label: "Start writing", action: "dismiss" }],
  },
];

interface Props { autoStart?: boolean; startKey?: number; }

export function OnboardingTour({ autoStart, startKey }: Props) {
  const tour = useTour({
    steps,
    closeOnEscape: true,
    closeOnInteractOutside: false,
    onStatusChange(details) {
      if (details.status === "completed" || details.status === "dismissed" || details.status === "skipped") {
        markTourCompleted();
      }
    },
  });

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    if (autoStart && !isTourCompleted()) {
      autoStarted.current = true;
      setTimeout(() => tour.start(), 800);
    }
  }, [autoStart]);

  const prevKey = useRef(0);
  useEffect(() => {
    if ((startKey ?? 0) > prevKey.current) {
      prevKey.current = startKey ?? 0;
      autoStarted.current = true;
      resetTourCompleted();
      setTimeout(() => tour.start(), 300);
    }
  }, [startKey]);

  const actions = tour.step?.actions ?? [];

  return (
    <Tour.Root tour={tour}>
      <Tour.Backdrop className="fixed inset-0 bg-black/35" style={{ zIndex: 9990 }} />
      <Tour.Spotlight
        className="fixed pointer-events-none rounded-lg"
        style={{ zIndex: 9991, boxShadow: "0 0 0 2px var(--accent), 0 0 0 9999px rgba(0,0,0,0.35)" }}
      />
      <Tour.Positioner
        className="flex pointer-events-none data-[type=dialog]:fixed data-[type=dialog]:inset-0 data-[type=dialog]:items-center data-[type=dialog]:justify-center"
        style={{ zIndex: 9992 }}
      >
        <Tour.Content
          className="relative pointer-events-auto bg-white border border-[var(--border-mid)] rounded-lg shadow-xl w-[360px] max-w-[calc(100vw-32px)] overflow-hidden font-[var(--font-ui)] data-[type=dialog]:text-center"
          style={{ zIndex: 9993 }}
        >
          <Tour.Arrow className="[--arrow-size:8px] [--arrow-background:white]">
            <Tour.ArrowTip className="border border-[var(--border-mid)]" />
          </Tour.Arrow>

          <div className="flex items-start justify-between gap-2 px-5 pt-5">
            <Tour.Title className="text-[15px] font-semibold text-[var(--text)] leading-tight m-0" />
            <Tour.CloseTrigger className="bg-transparent border-none cursor-pointer text-[var(--text-3)] p-1 -mt-0.5 -mr-1 rounded shrink-0 flex items-center justify-center hover:text-[var(--text)] hover:bg-black/5 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Tour.CloseTrigger>
          </div>

          <Tour.Description className="text-[13px] text-[var(--text-2)] leading-relaxed px-5 pt-2" />

          <div className="flex items-center justify-between px-5 pt-4 pb-[18px] gap-3">
            <Tour.ProgressText className="text-[12px] text-[var(--text-3)] whitespace-nowrap" />
            <div className="flex items-center gap-2">
              {actions.map((action) => {
                const isPrimary = action.action === "next" || action.action === "dismiss";
                return (
                  <Tour.ActionTrigger
                    key={action.label}
                    action={action}
                    className={
                      isPrimary
                        ? "text-[13px] font-medium px-[14px] py-[7px] rounded-md border cursor-pointer whitespace-nowrap transition-colors bg-[var(--accent)] text-white border-[var(--accent)] hover:bg-[var(--accent-2)]"
                        : "text-[13px] font-medium px-[14px] py-[7px] rounded-md border cursor-pointer whitespace-nowrap transition-colors bg-white text-[var(--text)] border-[var(--border-mid)] hover:bg-black/[0.03]"
                    }
                  >
                    {action.label}
                  </Tour.ActionTrigger>
                );
              })}
            </div>
          </div>
        </Tour.Content>
      </Tour.Positioner>
    </Tour.Root>
  );
}
