import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  saveCookies: () => ipcRenderer.invoke('save-cookies'),
  onGroupHtml: (callback: (html: string) => void) => ipcRenderer.on('group-html', (_, html) => callback(html))
})
