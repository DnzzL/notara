const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let serverProcess = null;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Notion Alt",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // In development, load the Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    const indexPath = path.join(__dirname, "../app/dist/index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startServer() {
  const serverPath = path.join(__dirname, "../server/dist/index.js");
  const isDev = process.env.NODE_ENV === "development";

  // In dev, use tsx to run TypeScript directly
  // In prod, use the compiled JS
  const execPath = isDev ? "bun" : process.execPath;
  const args = isDev
    ? ["--watch", path.join(__dirname, "../server/src/index.ts")]
    : [serverPath];

  serverProcess = spawn(execPath, args, {
    env: {
      ...process.env,
      DATA_DIR: app.getPath("userData"),
      NODE_ENV: process.env.NODE_ENV || "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (data) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[server] ${data.toString().trim()}`);
  });

  serverProcess.on("error", (err) => {
    console.error("[server] Failed to start:", err.message);
  });

  serverProcess.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[server] Exited with code ${code}, signal ${signal}`);
    }
  });
}

app.whenReady().then(() => {
  startServer();

  // Wait a moment for server to start, then open window
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Kill server process
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Quit if server fails and no window is open
app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
});
