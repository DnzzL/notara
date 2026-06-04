import { useState, useEffect, useRef } from "react";
import { useStore, usePageStore } from "../store.js";
import type { SearchResult } from "@notion-alt/shared";
import { cn } from "./ui/cn.js";

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#fef3c7] p-0 rounded-[2px]">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SearchModal() {
  const { globalSearch, searchResults, selectPageById } = useStore();
  const recentPages = usePageStore(s => s.recentPages);
  const loadRecentPages = usePageStore(s => s.loadRecentPages);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      globalSearch("");
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      await globalSearch(query);
      setIsSearching(false);
      setSelectedIndex(0);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, globalSearch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "/" && !isOpen) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && !(e.target as HTMLElement).isContentEditable) {
          e.preventDefault();
          setIsOpen(true);
        }
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (!query.trim()) loadRecentPages();
    }
  }, [isOpen, loadRecentPages, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const pageResults = searchResults.filter((r) => r.type === "page");
  const blockResults = searchResults.filter((r) => r.type === "block");

  const getFlatResults = (): SearchResult[] => {
    if (!query.trim()) return [];
    return [...pageResults, ...blockResults];
  };

  const navigateToResult = (result: SearchResult) => {
    selectPageById(result.pageId);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, getFlatResults().length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const flat = getFlatResults();
      if (flat[selectedIndex]) navigateToResult(flat[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  const flatResults = getFlatResults();
  const showRecent = !query.trim() && recentPages.length > 0;
  const hasResults = flatResults.length > 0;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center pt-[14vh] bg-[rgba(15,18,30,0.4)] backdrop-blur-[8px] [animation:fade-in_0.12s_var(--ease)]"
      onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
    >
      <div
        ref={modalRef}
        className="w-[600px] max-w-[90vw] bg-surface border border-border-mid rounded-lg shadow-[var(--shadow-xl)] overflow-hidden flex flex-col max-h-[420px] [animation:modal-pop_0.17s_var(--ease-spring)]"
      >
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-border gap-2.5">
          <span className="text-base shrink-0 text-text-3">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 border-none outline-none text-[15.5px] py-1 bg-transparent text-text placeholder:text-text-3"
            placeholder="Search pages and content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isSearching && (
            <span className="w-[15px] h-[15px] border-2 border-border-mid border-t-accent rounded-full [animation:spin_0.6s_linear_infinite] shrink-0" />
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[300px] p-1.5 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-surface-4 [&::-webkit-scrollbar-thumb]:rounded-[2px]">
          {showRecent && (
            <div>
              <div className="px-2.5 py-1.5 text-[10.5px] font-semibold text-text-3 uppercase tracking-[0.07em]">Recent</div>
              {recentPages.map((page, idx) => (
                <div
                  key={page.id}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3",
                    idx === selectedIndex && "bg-accent-dim"
                  )}
                  onClick={() => navigateToResult({ type: "page", id: page.id, title: page.title, content: "", pageId: page.id })}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="text-[15px] shrink-0 w-[22px] text-center">{page.icon || "📄"}</span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[13.5px] text-text whitespace-nowrap overflow-hidden text-ellipsis">{page.title || "Untitled"}</span>
                    <span className="text-[11.5px] text-text-3 whitespace-nowrap overflow-hidden text-ellipsis">Recent page</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasResults && (
            <>
              {pageResults.length > 0 && (
                <div>
                  <div className="px-2.5 py-1.5 text-[10.5px] font-semibold text-text-3 uppercase tracking-[0.07em]">Pages</div>
                  {pageResults.map((result, idx) => (
                    <div
                      key={result.id}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3",
                        idx === selectedIndex && "bg-accent-dim"
                      )}
                      onClick={() => navigateToResult(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className="text-[15px] shrink-0 w-[22px] text-center">📄</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13.5px] text-text whitespace-nowrap overflow-hidden text-ellipsis block">
                          {highlightText(result.title, query)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {blockResults.length > 0 && (
                <div>
                  <div className="px-2.5 py-1.5 text-[10.5px] font-semibold text-text-3 uppercase tracking-[0.07em]">Blocks in Pages</div>
                  {blockResults.map((result, idx) => {
                    const flatIdx = pageResults.length + idx;
                    return (
                      <div
                        key={result.id}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded transition-[background] duration-[var(--t)] ease-[var(--ease)] hover:bg-surface-3",
                          flatIdx === selectedIndex && "bg-accent-dim"
                        )}
                        onClick={() => navigateToResult(result)}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        <span className="text-[15px] shrink-0 w-[22px] text-center">📝</span>
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="text-[13.5px] text-text whitespace-nowrap overflow-hidden text-ellipsis">
                            {highlightText(result.title, query)}
                          </span>
                          <span className="text-[11.5px] text-text-3 whitespace-nowrap overflow-hidden text-ellipsis">
                            {result.content.slice(0, 120)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!showRecent && !hasResults && query.trim() && !isSearching && (
            <div className="py-7 px-4 text-center text-text-3 text-[13.5px]">No results found</div>
          )}

          {!showRecent && !hasResults && !query.trim() && (
            <div className="py-7 px-4 text-center text-text-3 text-[13.5px]">Start typing to search...</div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex justify-end gap-4 px-4 py-2 border-t border-border text-[11px] text-text-3">
          <span>↑↓ Navigate</span>
          <span>Enter Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
