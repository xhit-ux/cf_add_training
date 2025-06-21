import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveCookies: () => ipcRenderer.invoke('save-cookies')
});
