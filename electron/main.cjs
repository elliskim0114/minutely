const { app, BrowserWindow, shell } = require("electron");

const DEFAULT_WEB_URL = "https://minutelyplanner.vercel.app";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    title: "Minutely",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const appUrl = process.env.MINUTELY_WEB_URL || DEFAULT_WEB_URL;
  win.setTitle("minutely");
  win.loadURL(appUrl);

  win.on("page-title-updated", (event) => {
    event.preventDefault();
    win.setTitle("minutely");
  });

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
