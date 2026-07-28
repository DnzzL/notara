const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const http = require("node:http");

const isDev = process.env.NODE_ENV === "development";

let serverProcess = null;
let mainWindow = null;
let setupWindow = null;

// --- Persistent config ---

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

function loadAppConfig() {
	if (fs.existsSync(CONFIG_PATH)) {
		try {
			return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
		} catch {
			// corrupt — rebuild below
		}
	}
	return {};
}

function saveAppConfig(config) {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// --- Path resolution ---

function serverEntryPath() {
	if (isDev) return path.join(__dirname, "../server/src/index.ts");
	return path.join(process.resourcesPath, "dist/index.js");
}

function bunPath() {
	if (isDev) return "bun";
	const ext = process.platform === "win32" ? ".exe" : "";
	return path.join(process.resourcesPath, `bun${ext}`);
}

function dataDir() {
	return app.getPath("userData");
}

// --- Server lifecycle ---

function startServer(config) {
	if (!config.betterAuthSecret) {
		config.betterAuthSecret = crypto.randomBytes(32).toString("hex");
		saveAppConfig(config);
	}

	const entry = serverEntryPath();
	const args = isDev ? ["--watch", entry] : [entry];

	serverProcess = spawn(bunPath(), args, {
		cwd: isDev ? undefined : process.resourcesPath,
		env: {
			...process.env,
			DATA_DIR: dataDir(),
			NODE_ENV: "production",
			PORT: "3000",
			BASE_URL: "http://127.0.0.1:3000",
			TRUSTED_ORIGINS: "http://127.0.0.1:3000,http://localhost:3000",
			BETTER_AUTH_SECRET: config.betterAuthSecret,
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

function waitForServer(url, timeoutMs = 15000) {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		function poll() {
			const req = http.get(url, (res) => {
				if (res.statusCode === 200) {
					resolve();
				} else if (Date.now() - start > timeoutMs) {
					reject(new Error(`Server health check returned ${res.statusCode}`));
				} else {
					setTimeout(poll, 200);
				}
			});
			req.on("error", () => {
				if (Date.now() - start > timeoutMs) {
					reject(new Error("Server did not start within timeout"));
				} else {
					setTimeout(poll, 200);
				}
			});
			req.end();
		}
		poll();
	});
}

// --- Window ---

function createWindow(url) {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		title: "Notara",
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
		show: false,
	});

	mainWindow.loadURL(url);

	if (isDev) {
		mainWindow.webContents.openDevTools();
	}

	mainWindow.once("ready-to-show", () => {
		if (setupWindow) {
			setupWindow.close();
			setupWindow = null;
		}
		mainWindow.show();
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

// --- First-launch setup window ---

function showSetupWindow(config) {
	setupWindow = new BrowserWindow({
		width: 480,
		height: 340,
		title: "Notara Setup",
		resizable: false,
		webPreferences: { nodeIntegration: true, contextIsolation: false },
	});

	setupWindow.loadURL(
		`data:text/html;charset=utf-8,${encodeURIComponent(SETUP_HTML)}`,
	);

	setupWindow.on("closed", () => {
		setupWindow = null;
		// If the user closed setup without choosing, quit
		if (!config.mode) {
			app.quit();
		}
	});

	ipcMain.handle("set-local-mode", () => {
		config.mode = "local";
		saveAppConfig(config);
		launchApp(config);
	});

	ipcMain.handle("set-remote-mode", (_event, url) => {
		config.mode = "remote";
		config.remoteUrl = url.replace(/\/+$/, "");
		saveAppConfig(config);
		launchApp(config);
	});
}

// Inline HTML for the setup window (avoids a separate file in extraResources)
const SETUP_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Notara Setup</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f5f7; display:flex; align-items:center; justify-content:center; height:100vh; }
  .card { background:#fff; border-radius:12px; padding:32px; width:420px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  h1 { font-size:18px; font-weight:600; margin-bottom:8px; }
  p { font-size:13px; color:#666; margin-bottom:20px; }
  button { display:block; width:100%; padding:12px; border:none; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; margin-bottom:8px; }
  .local { background:#1a1a1a; color:#fff; }
  .remote-toggle { background:none; color:#2B4DFF; font-size:13px; text-decoration:underline; padding:4px; }
  .remote-section { display:none; margin-top:12px; }
  .remote-section input { width:100%; padding:8px 10px; border:1px solid #d1d1d6; border-radius:6px; font-size:13px; margin-bottom:8px; }
  .remote-section button { background:#2B4DFF; color:#fff; }
</style></head>
<body>
<div class="card">
  <h1>Welcome to Notara</h1>
  <p>Choose how you want to use Notara:</p>

  <div id="buttons">
    <button class="local" onclick="chooseLocal()">Use local database</button>
    <button class="remote-toggle" onclick="showRemote()">Connect to a remote server</button>
  </div>

  <div id="remote" class="remote-section">
    <label style="font-size:13px;color:#333;display:block;margin-bottom:4px;">Server URL</label>
    <input id="url" type="text" placeholder="https://notara.example.com" />
    <button onclick="chooseRemote()">Connect</button>
    <button class="remote-toggle" onclick="hideRemote()">Cancel</button>
  </div>
</div>
<script>
  const { ipcRenderer } = require("electron");

  function chooseLocal() {
    ipcRenderer.invoke("set-local-mode");
  }
  function showRemote() {
    document.getElementById("buttons").style.display = "none";
    document.getElementById("remote").style.display = "block";
    document.getElementById("url").focus();
  }
  function hideRemote() {
    document.getElementById("buttons").style.display = "block";
    document.getElementById("remote").style.display = "none";
  }
  function chooseRemote() {
    const url = document.getElementById("url").value.trim();
    if (!url) return;
    ipcRenderer.invoke("set-remote-mode", url);
  }
</script>
</body></html>`;

// --- App launch dispatch ---

async function launchApp(config) {
	buildAppMenu();

	// Use existing env var if set (dev mode), otherwise generate + persist
	if (!config.betterAuthSecret && process.env.BETTER_AUTH_SECRET) {
		config.betterAuthSecret = process.env.BETTER_AUTH_SECRET;
	}

	if (config.mode === "remote") {
		createWindow(config.remoteUrl);
	} else {
		startServer(config);
		try {
			await waitForServer("http://127.0.0.1:3000/health");
			console.log("[main] Server is ready");
		} catch (err) {
			console.error("[main] Server failed to start:", err.message);
			app.quit();
			return;
		}
		createWindow("http://127.0.0.1:3000");
	}

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
			if (config.mode === "remote") {
				createWindow(config.remoteUrl);
			} else {
				startServer(config);
				waitForServer("http://127.0.0.1:3000/health").then(() => {
					createWindow("http://127.0.0.1:3000");
				});
			}
		}
	});
}

// --- Native menu ---

function buildAppMenu() {
	const config = loadAppConfig();
	const isLocal = config.mode !== "remote";

	const template = [
		{
			label: app.name,
			submenu: [
				{ role: "about" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit" },
			],
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" },
			],
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "forceReload" },
				{ type: "separator" },
				{ role: "resetZoom" },
				{ role: "zoomIn" },
				{ role: "zoomOut" },
				{ type: "separator" },
				{ role: "togglefullscreen" },
			],
		},
		{
			label: "Window",
			submenu: [
				{ role: "minimize" },
				{ role: "close" },
				{ type: "separator" },
				{
					label: `Switch to ${isLocal ? "Remote" : "Local"} Mode`,
					visible: true,
					click: () => {
						if (isLocal) {
							showRemoteSwitchWindow(config);
						} else {
							config.mode = "local";
							delete config.remoteUrl;
							saveAppConfig(config);
							app.relaunch();
							app.exit();
						}
					},
				},
			],
		},
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showRemoteSwitchWindow(config) {
	const win = new BrowserWindow({
		width: 400,
		height: 160,
		title: "Connect to Remote Server",
		resizable: false,
		parent: mainWindow,
		modal: true,
		webPreferences: { nodeIntegration: true, contextIsolation: false },
	});

	win.loadURL(
		`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, sans-serif; background:#f5f5f7; display:flex; align-items:center; justify-content:center; height:100vh; }
  .card { background:#fff; border-radius:10px; padding:24px; width:360px; }
  label { font-size:13px; color:#333; display:block; margin-bottom:4px; }
  input { width:100%; padding:8px 10px; border:1px solid #d1d1d6; border-radius:6px; font-size:13px; margin-bottom:12px; }
  .rows { display:flex; gap:8px; }
  button { flex:1; padding:8px; border:none; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; }
  .connect { background:#2B4DFF; color:#fff; }
  .cancel { background:#e5e5ea; color:#333; }
</style></head>
<body><div class="card">
  <label>Server URL</label>
  <input id="url" type="text" placeholder="https://notara.example.com" value="${config.remoteUrl || ""}" />
  <div class="rows">
    <button class="cancel" onclick="window.close()">Cancel</button>
    <button class="connect" onclick="save()">Connect</button>
  </div>
</div>
<script>
  const { ipcRenderer } = require("electron");
  function save() {
    ipcRenderer.send("set-remote-url", document.getElementById("url").value.trim());
  }
</script></body></html>`)}`,
	);

	ipcMain.once("set-remote-url", (_event, url) => {
		if (!url) return;
		config.mode = "remote";
		config.remoteUrl = url.replace(/\/+$/, "");
		saveAppConfig(config);
		app.relaunch();
		app.exit();
	});
}

// --- App lifecycle ---

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
	});

	app.whenReady().then(async () => {
		if (isDev) {
			// Dev mode: always load Vite dev server, skip setup/config
			buildAppMenu();
			createWindow("http://localhost:5173");
			app.on("activate", () => {
				if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
					createWindow("http://localhost:5173");
				}
			});
			return;
		}

		const config = loadAppConfig();

		if (!config.mode) {
			showSetupWindow(config);
		} else {
			launchApp(config);
		}
	});

	app.on("window-all-closed", () => {
		if (serverProcess) {
			serverProcess.kill("SIGTERM");
			serverProcess = null;
		}
		if (process.platform !== "darwin") {
			app.quit();
		}
		// On macOS, quit if setup was dismissed (no config yet)
		if (
			process.platform === "darwin" &&
			setupWindow === null &&
			mainWindow === null
		) {
			const config = loadAppConfig();
			if (!config.mode) app.quit();
		}
	});

	app.on("before-quit", () => {
		if (serverProcess) {
			serverProcess.kill("SIGTERM");
		}
	});
}
