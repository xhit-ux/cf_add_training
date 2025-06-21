import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let win: BrowserWindow;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      webviewTag: true, // ← 启用 webview 标签
      partition: 'persist:authsession' // ← 共享 webview 和 session
    }
  });

  win.loadFile(path.join(__dirname, '../public/login.html'));
}

ipcMain.handle('save-cookies', async () => {
  const cookies = await session.fromPartition('persist:authsession').cookies.get({});
  fs.mkdirSync('cookies', { recursive: true });
  fs.writeFileSync('cookies/cookies.json', JSON.stringify(cookies, null, 2));
  return cookies;
});

app.whenReady().then(() => {
  createWindow();
});
