import { app, BrowserWindow, shell, dialog } from "electron";
import { spawn, ChildProcess, execSync } from "child_process";
import { autoUpdater } from "electron-updater";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 5000;
const LOG_FILE = path.join(app.getPath("temp"), "photon-server.log");
let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let logStream: fs.WriteStream | null = null;

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  logStream?.write(line);
}

function killPort(port: number) {
  try {
    if (process.platform === "win32") {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const lines = result.trim().split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") {
          try { execSync(`taskkill /PID ${pid} /F`); } catch {}
        }
      }
    }
  } catch {}
}

function killServer() {
  if (serverProcess) {
    if (process.platform === "win32") {
      try { execSync(`taskkill /PID ${serverProcess.pid} /T /F`); } catch {}
    } else {
      serverProcess.kill("SIGTERM");
    }
    serverProcess = null;
  }
}

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clear old log file and open new stream
    logStream = fs.createWriteStream(LOG_FILE, { flags: "w" });
    log(`Log file: ${LOG_FILE}`);

    // Kill any process already holding our port
    killPort(PORT);

    const serverPath = path.join(__dirname, "..", "dist", "index.cjs");
    const rootDir = path.join(__dirname, "..");
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        ELECTRON_RUN: "true",
        PORT: String(PORT),
        DOTENV_CONFIG_PATH: path.join(rootDir, ".env"),
        AUTH_LOG_FILE: LOG_FILE,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProcess.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      log(`[server] ${msg}`);
      if (msg.includes("serving on port")) resolve();
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      log(`[server-err] ${data.toString().trim()}`);
    });

    serverProcess.on("error", (err) => {
      log(`[server-spawn-error] ${err.message}`);
      reject(err);
    });

    serverProcess.on("exit", (code) => {
      log(`[server-exit] code=${code}`);
    });

    setTimeout(resolve, 8000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "PHOTON",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Open external links in the system browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    log(`Update available: v${info.version}`);
    mainWindow?.webContents.send("update-available", info.version);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log(`Update downloaded: v${info.version}`);
    dialog.showMessageBox({
      type: "info",
      title: "Update Ready",
      message: `PHOTON v${info.version} is ready to install.`,
      buttons: ["Restart Now", "Later"],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on("error", (err) => {
    log(`Auto-updater error: ${err.message}`);
  });

  // Check for updates 5 seconds after startup (gives the window time to load)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 5000);
}

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error("Failed to start server:", err);
  }
  createWindow();

  if (app.isPackaged) {
    setupAutoUpdater();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  killServer();
  logStream?.end();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  killServer();
  logStream?.end();
});
