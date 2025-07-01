import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fetchGroups } from './fetchGroups';

let win: BrowserWindow;


function extractGroupPage(rawHtml: string): string {
  const finalHtml = rawHtml.replace(
    /<th style="width: 2\.4em;"><\/th>/g,
    `<th style="width: 2.4em;">请勾选拉题group</th>`
  );
  return finalHtml.replace(
    /<tr>\s*<td>\s*<a[^>]*>(.*?)<\/a>\s*<\/td>\s*<td>\s*(.*?)\s*<\/td>\s*<td>\s*<span[^>]*>\s*(.*?)\s*<\/span>\s*<\/td>\s*<td class="time-row">\s*<span[^>]*>(.*?)<\/span>\s*<\/td>\s*<td class="time-row">\s*<span[^>]*>\s*<span[^>]*>(.*?)<\/span>\s*<\/span>\s*<\/td>\s*<td>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>(?:[\s\S]*?)<\/td>\s*<\/tr>/g,
    (_, groupName, role, invitation, since, invited) => {
      return `
  <tr>
    <td>
      ${groupName}
    </td>
  
    <td>
      ${role}
    </td>
  
    <td>
      ${invitation}
    </td>
  
    <td class="time-row">
      <span class="format-time" data-locale="en">${since}</span>
    </td>
  
    <td class="time-row">
      <span title="Time when user was invited to group">
        <span class="format-time" data-locale="en">${invited}</span>
      </span>
    </td>
  
    <td>
      <input type="radio">
    </td>
  </tr>`;
    }
  );
  
}


async function extractCookiesAsHeader(): Promise<string> {
  const cookies = await session.fromPartition('persist:authsession').cookies.get({});
  fs.mkdirSync('cookies', { recursive: true });
  fs.writeFileSync('cookies/cookies.json', JSON.stringify(cookies, null, 2));

  const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  console.log('\n[+] 构造出的 Cookie 请求头格式:');
  console.log(cookieHeader);

  // 执行抓取 Group 页面的 HTML
  const rawhtml = await fetchGroups(cookieHeader);
  const html = extractGroupPage(rawhtml);
  win.loadFile(path.join(__dirname, '../public/mygroup.html'));

  // 发送给前端页面（mygroup.html）
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('group-html', html);
  });

  return cookieHeader;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      webviewTag: true,
      partition: 'persist:authsession'
    }
  });

  win.loadFile(path.join(__dirname, '../public/login.html'));
}

ipcMain.handle('save-cookies', async () => {
  const cookieHeader = await extractCookiesAsHeader();
  return { status: 'done' };
});

app.whenReady().then(() => {
  createWindow();
});
