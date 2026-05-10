import { createRoot } from "react-dom/client";
import { Sidebar } from "./components/Sidebar.js";
import { BlockEditor } from "./components/BlockEditor.js";
import "./styles.css";

function App() {
  return (
    <div className="app">
      <Sidebar />
      <BlockEditor />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
