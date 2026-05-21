import { useState, useEffect, useRef } from "react";
import { useStore, usePageStore } from "../store.js";
import type { SearchResult, Page } from "@notion-alt/shared";

/** Highlight matched text segments in a string. */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "#fef3c7", padding: 0, borderRadius: 2 }}>{text.slice(idx, idx + query.length)}</mark>
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

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      console.log("[SearchModal] globalSearch called with empty query");
      globalSearch("");
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      console.log("[SearchModal] globalSearch called with query:", query);
      await globalSearch(query);
      setIsSearching(false);
      setSelectedIndex(0);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, globalSearch]);

  // Keyboard shortcut: Cmd+K / Ctrl+K to toggle, / when not in input
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

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log("[SearchModal] Modal opened, query:", query);
      setTimeout(() => inputRef.current?.focus(), 50);
      if (!query.trim()) {
        console.log("[SearchModal] Loading recent pages");
        loadRecentPages();
      }
    }
  }, [isOpen, loadRecentPages, query]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      console.log("[SearchModal] Modal closed");
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation within modal
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
      console.log("[SearchModal] Enter pressed, selectedIndex:", selectedIndex, "flatResults:", flat);
      if (flat[selectedIndex]) {
        console.log("[SearchModal] Navigating to:", flat[selectedIndex]);
        navigateToResult(flat[selectedIndex]);
      }
    }
  };

  // Build grouped results
  const pageResults = searchResults.filter((r) => r.type === "page");
  const blockResults = searchResults.filter((r) => r.type === "block");

  const getFlatResults = (): SearchResult[] => {
    if (!query.trim()) return [];
    return [...pageResults, ...blockResults];
  };

  const navigateToResult = (result: SearchResult) => {
    console.log("[SearchModal] navigateToResult called with:", result);
    selectPageById(result.pageId);
    setIsOpen(false);
    setQuery("");
  };

  if (!isOpen) return null;

  const flatResults = getFlatResults();
  const showRecent = !query.trim() && recentPages.length > 0;
  const hasResults = flatResults.length > 0;

  return (
    <div
      className="search-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div className="search-modal" ref={modalRef}>
        {/* Search input */}
        <div className="search-input-row">
          <span className="search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search pages and content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {isSearching && <span className="search-spinner" />}
        </div>

        {/* Results */}
        <div className="search-results">
          {showRecent && (
            <div className="search-section">
              <div className="search-section-header">Recent</div>
              {recentPages.map((page, idx) => (
                <div
                  key={page.id}
                  className={`search-item ${idx === selectedIndex ? "selected" : ""}`}
                  onClick={() => navigateToResult({ type: "page", id: page.id, title: page.title, content: "", pageId: page.id })}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="search-item-icon">{page.icon || "📄"}</span>
                  <div className="search-item-content">
                    <span className="search-item-title">{page.title || "Untitled"}</span>
                    <span className="search-item-subtitle">Recent page</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasResults && (
            <>
              {pageResults.length > 0 && (
                <div className="search-section">
                  <div className="search-section-header">Pages</div>
                  {pageResults.map((result, idx) => {
                    const flatIdx = idx;
                    return (
                      <div
                        key={result.id}
                        className={`search-item ${flatIdx === selectedIndex ? "selected" : ""}`}
                        onClick={() => navigateToResult(result)}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        <span className="search-item-icon">📄</span>
                        <div className="search-item-content">
                          <span className="search-item-title">
                            {highlightText(result.title, query)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {blockResults.length > 0 && (
                <div className="search-section">
                  <div className="search-section-header">
                    Blocks in Pages
                  </div>
                  {blockResults.map((result, idx) => {
                    const flatIdx = pageResults.length + idx;
                    return (
                      <div
                        key={result.id}
                        className={`search-item ${flatIdx === selectedIndex ? "selected" : ""}`}
                        onClick={() => navigateToResult(result)}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                      >
                        <span className="search-item-icon">📝</span>
                        <div className="search-item-content">
                          <span className="search-item-title">
                            {highlightText(result.title, query)}
                          </span>
                          <span className="search-item-subtitle">
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
            <div className="search-empty">No results found</div>
          )}

          {!showRecent && !hasResults && !query.trim() && (
            <div className="search-empty">Start typing to search...</div>
          )}
        </div>

        {/* Footer hint */}
        <div className="search-footer">
          <span>↑↓ Navigate</span>
          <span>Enter Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
