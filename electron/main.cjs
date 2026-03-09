const { app, BrowserWindow, shell } = require("electron");

const DEFAULT_WEB_URL = "https://minutelyplanner.vercel.app";

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: "Minutely",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const appUrl = process.env.MINUTELY_WEB_URL || DEFAULT_WEB_URL;
  win.loadURL(appUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
