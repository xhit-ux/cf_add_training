import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveCookies: () => ipcRenderer.invoke('save-cookies'),

  getConfig: () => ipcRenderer.sendSync("get-config-sync"),

  saveConfig: (username:string, password:string) => ipcRenderer.invoke("save-config", { username, password }),

  onGroupHtml: (callback: (html: string) => void) =>
    ipcRenderer.on('group-html', (_, html) => callback(html)),

  catProblemWithRange: (
    name: string,
    duration: number,
    ranges: [number, number][],
    count: number
  ) => ipcRenderer.invoke("cat-problem-range", name, duration, ranges, count),
  

  publishContest: (groupIds: string[]) => ipcRenderer.invoke("publish-contest", groupIds)
});
