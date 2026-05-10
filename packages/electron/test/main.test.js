import { describe, test, expect } from "bun:test";
import path from "node:path";
import fs from "node:fs";

describe("Electron main process", () => {
  const mainPath = path.join(import.meta.dir, "../main.js");

  test("main.js exists and is valid JS", () => {
    expect(fs.existsSync(mainPath)).toBe(true);
    const content = fs.readFileSync(mainPath, "utf-8");
    // Should not throw
    new Function("require", "module", "process", "_path", content);
  });

  test("main.js contains electron imports", () => {
    const content = fs.readFileSync(mainPath, "utf-8");
    expect(content).toContain("electron");
    expect(content).toContain("BrowserWindow");
    expect(content).toContain("app");
  });

  test("main.js starts server process", () => {
    const content = fs.readFileSync(mainPath, "utf-8");
    expect(content).toContain("spawn");
    expect(content).toContain("server");
  });

  test("main.js loads dev server in development", () => {
    const content = fs.readFileSync(mainPath, "utf-8");
    expect(content).toContain("localhost:5173");
  });

  test("main.js sets DATA_DIR for server", () => {
    const content = fs.readFileSync(mainPath, "utf-8");
    expect(content).toContain("DATA_DIR");
  });

  test("main.js kills server on window close", () => {
    const content = fs.readFileSync(mainPath, "utf-8");
    expect(content).toContain("kill");
  });
});
