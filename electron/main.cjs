// HNI Pricing — desktop shell (design: docs/designs/desktop-packaging.md, APPROVED).
// Personal OFFLINE edition: serves the localStorage-mode web build over a
// privileged app:// scheme. The scheme (not file://) is the load-bearing
// decision: fetch() of brand assets, absolute asset paths, and clipboard's
// secure-context requirement all keep working with ZERO web-build changes.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, protocol, net, shell, ipcMain, dialog } = require("electron");

// MUST run before app.whenReady (classic first-run failure).
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const DIST = path.join(__dirname, "..", "dist");

function resolveDistPath(urlPath) {
  // app://bundle/<path> → dist/<path>; block traversal outside dist.
  const rel = decodeURIComponent(urlPath.replace(/^\/+/, "")) || "index.html";
  const abs = path.normalize(path.join(DIST, rel));
  if (!abs.startsWith(DIST)) return path.join(DIST, "index.html");
  return abs;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "HNI Pricing",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      devTools: !!process.env.HNI_DEBUG,
    },
  });

  // External navigation denied; http(s) links open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  void win.loadURL("app://bundle/index.html");
  return win;
}

// One-click Save-as-PDF (replaces the browser print-dialog dance).
// preferCSSPageSize makes print.css's @page 13.33in x 7.5in the source of
// truth; the explicit pageSize (INCHES) is the no-@page fallback.
ipcMain.handle("hni:save-pdf", async (event, suggestedName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false };
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: suggestedName || "HNI-Proposal.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return { ok: false };
  const pdf = await event.sender.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    pageSize: { width: 13.33, height: 7.5 },
  });
  await require("node:fs/promises").writeFile(filePath, pdf);
  return { ok: true, filePath };
});

app.whenReady().then(() => {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    return net.fetch(pathToFileURL(resolveDistPath(pathname)).toString());
  });

  const win = createWindow();

  // Packaging smoke test: HNI_SMOKE=1 quits with 0 once the app actually
  // rendered (root has children), non-zero otherwise.
  if (process.env.HNI_SMOKE) {
    win.webContents.on("did-finish-load", () => {
      void win.webContents
        .executeJavaScript("document.querySelector('#root') && document.querySelector('#root').children.length > 0")
        .then((rendered) => app.exit(rendered ? 0 : 2))
        .catch(() => app.exit(3));
    });
    setTimeout(() => app.exit(4), 20000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
