// Minimal bridge (design: desktop-packaging.md): ONE capability, the
// one-click PDF save. ClientView feature-detects window.hniDesktop?.savePdf;
// the web build never sees this object.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hniDesktop", {
  savePdf: (suggestedName) => ipcRenderer.invoke("hni:save-pdf", suggestedName),
});
