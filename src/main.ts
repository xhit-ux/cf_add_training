import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fetchGroups, extractGroup } from './fetchGroups';
import { publicProblem } from './publicProblem';

let win: BrowserWindow;

let csrf_token = "";
let cookie_all = "";

function extractGroupPage(rawHtml: string): string {
  let finalHtml = rawHtml.replace(
    /<th style="width: 2\.4em;"><\/th>/g,
    `<th>请勾选拉题group</th>`
  );
  finalHtml = finalHtml.replace(
    /<th style="width: 7em;">Role<\/th>/g,
    `<th>Role</th>`
  );
  finalHtml = finalHtml.replace(
    /<th style="width: 10em;">Invitation<\/th>/g,
    `<th>Invitation</th>`
  );
  finalHtml = finalHtml.replace(
    /<th style="width: 14em;">Member since<\/th>/g,
    `<th>Member since</th>`
  );
  finalHtml = finalHtml.replace(
    /<th style="width: "width: 14em;">Invited on<\/th>/g,
    `<th>Invited on</th>`
  );
  return finalHtml.replace(
    /<tr>\s*<td>\s*<a\s+href="\/group\/([^"]+)"[^>]*>(.*?)<\/a>\s*<\/td>\s*<td>\s*(.*?)\s*<\/td>\s*<td>\s*<span[^>]*>\s*(.*?)\s*<\/span>\s*<\/td>\s*<td class="time-row">\s*<span[^>]*>(.*?)<\/span>\s*<\/td>\s*<td class="time-row">\s*<span[^>]*>\s*<span[^>]*>(.*?)<\/span>\s*<\/span>\s*<\/td>\s*<td>[\s\S]*?<\/td>\s*<\/tr>/g,
    (_, groupId, groupName, role, invitation, since, invited) => {
      return `
    <tr>
      <td>
        <a href="https://codeforces.com/group/${groupId}" class="groupName">${groupName}</a>
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
        <input type="checkbox" name="group" value="${groupId}">
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
  cookie_all = cookieHeader;
  // console.log('\n[+] 构造出的 Cookie 请求头格式:');
  // console.log(cookieHeader);

  // 执行抓取 Group 页面的 HTML
  const rawhtml = await fetchGroups(cookieHeader);
  
  //提取csrf
  const match = rawhtml.match(/<input\s+type=['"]hidden['"]\s+name=['"]csrf_token['"]\s+value=['"]([a-f0-9]{32})['"]\s*\/?>/i);
  if (match) {
    csrf_token = match[1];
    console.log('[+] 提取到 csrf_token:', csrf_token);
  } else {
    console.warn('[-] 未能提取 csrf_token');
    csrf_token = '';
  }
  //TODO 
  // 、
  // 
  //动态维护cookie
  
  //===================

  //构造页面部分
  
  const html = extractGroupPage(extractGroup(rawhtml));
  // console.log(html);//修改后数据，控制台输出
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
    height: 900,
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
  await extractCookiesAsHeader();
  return { status: 'done' };
});

ipcMain.on('cat-problem-range', async (event, contestName, contestDuration, tagsRange, count) => {
  if (!csrf_token) {
    console.error("[-] csrf_token 未初始化");
    return;
  }
  await publicProblem(csrf_token, contestName, contestDuration, tagsRange, count);
});



app.whenReady().then(() => {
  createWindow();
});
