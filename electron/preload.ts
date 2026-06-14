// Preload script runs in the renderer before web content loads.
// Keep it minimal — the app is a standard web app served by Express.
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});
