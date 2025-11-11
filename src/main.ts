import { app, BrowserWindow, ipcMain, session } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import yaml from "js-yaml";
import { fetchGroups, extractGroup } from "./fetchGroups";
import { publicProblem } from "./publicProblem";

const SECRET_KEY = crypto
  .createHash("sha256")
  .update("my-secret-key")
  .digest();
const IV = Buffer.alloc(16, 0);

type AppConfig = { login: { username: string; password: string } };

const paths = {
  userDataDir: "",
  configPath: "",
  cookiesDir: "",
  savedProblemsDir: "",
  logDir: "",
  logFile: ""
};

function encrypt(text: string): string {
  const cipher = crypto.createCipheriv("aes-256-cbc", SECRET_KEY, IV);
  return Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString(
    "base64"
  );
}

function decrypt(enc: string): string {
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", SECRET_KEY, IV);
    return Buffer.concat([
      decipher.update(Buffer.from(enc, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return "";
  }
}

function initStoragePaths() {
  paths.userDataDir = app.getPath("userData");
  paths.configPath = path.join(paths.userDataDir, "config.yaml");
  paths.cookiesDir = path.join(paths.userDataDir, "cookies");
  paths.savedProblemsDir = path.join(paths.userDataDir, "savedProblems");
  paths.logDir = path.join(paths.userDataDir, "logs");
  paths.logFile = path.join(paths.logDir, "app.log");

  [paths.cookiesDir, paths.savedProblemsDir, paths.logDir].forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });

  if (!fs.existsSync(paths.configPath)) {
    const defaultCfg = yaml.dump({ login: { username: "", password: "" } });
    fs.writeFileSync(paths.configPath, defaultCfg, "utf8");
  }

  fs.appendFileSync(
    paths.logFile,
    `\n--- App start ${new Date().toISOString()} ---\n`
  );
}

function log(level: "info" | "warn" | "error", message: string, ...args: any[]) {
  const ts = new Date().toISOString();
  const formatted = `[${ts}] [${level.toUpperCase()}] ${message}`;
  console[level](formatted, ...args);

  if (!paths.logFile) return;

  const extra =
    args.length > 0
      ? " " +
        args
          .map((arg) => {
            if (typeof arg === "string") return arg;
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(" ")
      : "";

  try {
    fs.appendFileSync(paths.logFile, `${formatted}${extra}\n`);
  } catch {
    // ignore write errors
  }
}

let CONFIG: AppConfig = { login: { username: "", password: "" } };
let win: BrowserWindow | null = null;
let csrfToken = "";
let cookieHeaderCache = "";
let contestId = "";

function loadConfig() {
  try {
    const raw = fs.readFileSync(paths.configPath, "utf8");
    const parsed = yaml.load(raw) as AppConfig;
    CONFIG = parsed || CONFIG;

    if (CONFIG.login.password) {
      CONFIG.login.password = decrypt(CONFIG.login.password);
    }
    log("info", "[main] config loaded", { hasLogin: !!CONFIG.login.username });
  } catch (err) {
    log("warn", "[main] load config failed", err);
  }
}

function saveConfig(username: string, password: string) {
  CONFIG = { login: { username, password } };
  const persisted = {
    login: {
      username,
      password: encrypt(password)
    }
  };
  try {
    fs.writeFileSync(paths.configPath, yaml.dump(persisted), "utf8");
    log("info", "[main] config saved");
  } catch (err) {
    log("error", "[main] config save failed", err);
  }
}

function extractGroupPage(rawHtml: string): string {
  let finalHtml = rawHtml.replace(
    /<th style="width: 2\.4em;"><\/th>/g,
    `<th>请选择Group</th>`
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
      <td>${role}</td>
      <td>${invitation}</td>
      <td class="time-row">
        <span class="format-time" data-locale="en">${since}</span>
      </td>
      <td class="time-row">
        <span class="format-time" data-locale="en">${invited}</span>
      </td>
      <td>
        <input type="checkbox" name="group" value="${groupId}">
      </td>
    </tr>`;
    }
  );
}

async function extractCookiesAsHeader(): Promise<string> {
  const cookies = await session
    .fromPartition("persist:authsession")
    .cookies.get({});

  fs.mkdirSync(paths.cookiesDir, { recursive: true });
  fs.writeFileSync(
    path.join(paths.cookiesDir, "cookies.json"),
    JSON.stringify(cookies, null, 2),
    "utf8"
  );

  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  cookieHeaderCache = cookieHeader;

  const rawHtml = await fetchGroups(cookieHeader);
  const match = rawHtml.match(
    /<input\s+type=['"]hidden['"]\s+name=['"]csrf_token['"]\s+value=['"]([a-f0-9]{32})['"]\s*\/?>/i
  );
  if (match) {
    csrfToken = match[1];
    log("info", "[+] 提取到 csrf_token", csrfToken);
  } else {
    log("warn", "[-] 未能提取 csrf_token");
    csrfToken = "";
  }

  const html = extractGroupPage(extractGroup(rawHtml));
  win?.loadFile(path.join(__dirname, "../public/mygroup.html"));
  win?.webContents.once("did-finish-load", () => {
    win?.webContents.send("group-html", html);
  });

  return cookieHeader;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      webviewTag: true,
      partition: "persist:authsession"
    }
  });

  win.loadFile(path.join(__dirname, "../public/login.html"));
}

ipcMain.handle("save-config", (_, { username, password }) => {
  saveConfig(username, password);
  return true;
});

ipcMain.on("get-config-sync", (event) => {
  event.returnValue = CONFIG;
});

ipcMain.handle("save-cookies", async () => {
  await extractCookiesAsHeader();
  return { status: "done" };
});

ipcMain.handle(
  "cat-problem-range",
  async (_, contestName, contestDuration, tagsRange, count) => {
    if (!csrfToken) {
      throw new Error("CSRF 未初始化，请先保存 Cookie");
    }
    contestId = await publicProblem(
      csrfToken,
      contestName,
      contestDuration,
      tagsRange,
      count
    );
    log("info", "[+] contestID ready", contestId);
    return contestId;
  }
);

ipcMain.handle("publish-contest", async (_, groupIds: string[]) => {
  if (!cookieHeaderCache || !csrfToken) {
    throw new Error("Cookie 或 CSRF 还未初始化");
  }
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    throw new Error("请至少选择一个 Group");
  }

  const results: Array<{ groupId: string; status?: number; response?: string; error?: string }> = [];

  for (const groupId of groupIds) {
    const formData = new URLSearchParams();
    formData.append("csrf_token", csrfToken);
    formData.append("action", "addContest");
    formData.append("contestId", contestId);

    try {
      const response = await session
        .fromPartition("persist:authsession")
        .fetch(`https://codeforces.com/group/${groupId}/contests/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: `https://codeforces.com/group/${groupId}/contests/add`
          },
          body: formData.toString()
        });

      const text = await response.text();
      log("info", "[+] 已发布到小组", { groupId, status: response.status });
      results.push({ groupId, status: response.status, response: text });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知错误，发布失败";
      log("error", "[-] 发布到小组失败", { groupId, error: message });
      results.push({ groupId, error: message });
    }
  }

  const success = results.every((item) => !item.error);
  return { success, results };
});

app.whenReady().then(() => {
  initStoragePaths();
  loadConfig();
  createWindow();
});
