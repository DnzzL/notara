import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar.js";
import { BlockEditor } from "./components/BlockEditor.js";
import { SearchModal } from "./components/SearchModal.js";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts.js";
import { useStore } from "./store.js";
import "./styles.css";

function App() {
  const { loadPages, selectPageById } = useStore();

  // Load pages on mount and check for page ID in URL
  useEffect(() => {
    const init = async () => {
      await loadPages();
      
      // Check for page ID in URL query params
      const urlParams = new URLSearchParams(window.location.search);
      const pageId = urlParams.get('page');
      if (pageId) {
        await selectPageById(pageId);
      }
    };
    init();

    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("page");
      if (id) selectPageById(id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <BlockEditor />
      <SearchModal />
      <KeyboardShortcuts />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
