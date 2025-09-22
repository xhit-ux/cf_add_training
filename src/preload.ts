import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveCookies: () => ipcRenderer.invoke('save-cookies'),

  onGroupHtml: (callback: (html: string) => void) =>
    ipcRenderer.on('group-html', (_, html) => callback(html)),

  catProblemWithRange: (
    name: string,
    duration: number,
    ranges: [number, number][],
    count: number
  ) => ipcRenderer.send("cat-problem-range", name, duration, ranges, count),

  publishContest: (groupId: string) => ipcRenderer.invoke("publish-contest", groupId)
});

