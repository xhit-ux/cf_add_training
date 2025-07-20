## 项目当前卡在了发送new mashup的数据包的位置，求路过的大佬能够帮忙看看  

也就是publicProblem.ts的publicProblem函数，发送的那个数据包会返回302被踢回首页  
求大佬help

# Codeforces 登录与题目管理系统（基于 Electron）

## 1. 项目概述

该项目是一个基于 Electron 的桌面应用程序，旨在实现对 [Codeforces](https://codeforces.com) 平台的自动登录、题目拉取与发布操作。用户可以通过 GUI 界面登录 Codeforces，自动获取 Cookies，并基于题目标签区间和数量拉取指定题库题目，最终将其用于构建比赛或存储。

---

## 2. 技术选型

| 技术                    | 说明                           |
| ----------------------- | ------------------------------ |
| **Electron**            | 用于构建跨平台的桌面应用程序   |
| **TypeScript**          | 提高代码可维护性和类型安全     |
| **Node.js + Fetch API** | 实现与 Codeforces 的 HTTP 通信 |
| **HTML/CSS/JS**         | 构建前端交互界面               |

---

## 3. 功能模块划分

| 模块名             | 说明                                     |
| ------------------ | ---------------------------------------- |
| `main.ts`          | Electron 主进程：窗口管理，监听事件      |
| `preload.ts`       | 渲染进程和主进程通信桥梁                 |
| `login.html`       | 登录页面：展示 WebView 登录并提取 Cookie |
| `publicProblem.ts` | 拉取题目数据、生成比赛题单               |
| `fetchGroups.ts`   | 登录后抓取 Codeforces 群组页面 HTML      |
| `setProblem.html`  | 用户输入题目数量与标签范围进行筛选       |
| `mygroup.html`     | 展示抓取到的群组页面（部分功能）         |

---

## 4. 项目运作流程

### （1）登录流程

1. 用户运行程序，Electron 加载 `login.html` 页面；
2. `login.html` 中嵌入 Codeforces 登录页 WebView；
3. 用户手动登录后，`preload.ts` 自动监听登录成功并提取 Cookie；
4. Cookie 被保存到主进程，全局使用。

### （2）设置题目流程

1. 登录成功后跳转到 `setProblem.html`；
2. 用户填写比赛信息：
   - 比赛名称；
   - 比赛时长；
   - 题目数；
   - 标签难度范围（支持多区间）；
3. 页面发送 `ipcRenderer` 消息至主进程，调用 `publicProblem()`。

### （3）拉取题目与发布 //当前存在问题

```ts
// publicProblem.ts
export async function publicProblem(
  cookieHeader: string,
  csrfToken: string,
  contestName: string,
  contestDuration: number,
  tagsRange: [number, number][],
  count: number
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const problems1 = await getProblems(cookieHeader, tagsRange, count);
    console.log("题目信息:", problems1);
    const problems = encode_self(problems1);
    const postData = querystring.stringify({
      action: 'saveMashup',
      isCloneContest: 'false',
      parentContestIdAndName: '',
      parentContestId: '',
      contestName: contestName,
      contestDuration: contestDuration.toString(),
      problemsJson: problems,
      csrf_token: csrfToken
    });
    console.log("[DEBUG] 最终请求体 postData：", postData);

    const options: https.RequestOptions = {
      hostname: 'codeforces.com',
      path: '/data/mashup',
      method: 'POST',
      headers: {
        'Host': 'codeforces.com',
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData),
        'Referer': 'https://codeforces.com/mashup/new',
        'X-Csrf-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://codeforces.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Priority': 'u=0',
        'Te': 'trailers'
      }
    };

    const req = https.request(options, res => {
      const chunks: Buffer[] = [];

      res.on('data', chunk => {
        chunks.push(chunk);
      });

      res.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const encoding = res.headers['content-encoding'];
          const responseBody = await decodeBuffer(buffer, encoding);
          console.log(responseBody);
          console.log('[+] 以上拉题请求响应:');
          resolve();
        } catch (e) {
          console.error('[-] 解码响应失败:', e);
          reject(e);
        }
      });
      
    });

    req.on('error', err => {
      console.error('[-] 拉题请求错误:', err);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

```

### 内部流程：

1. `catProblemnums()` 获取当前标签范围下题库总数；

2. 随机选择指定数量题号；

3. 调用 pullProblem() 拉取题目信息；

4. 最终返回题目数组，构造比赛 JSON 数据包。

## 5. 核心代码逻辑说明  

**获取题目流程（摘自 `getProblems` 函数）：**

```ts
while (selectedNumbers.size < count) {
  selectedNumbers.add(randomInt(1, totalProblems)); // 随机选择题号
}
```

**公共题目组装逻辑：**

```ts
const problems1 = await getProblems(cookieHeader, tagsRange, count);
const problems = encode_self(problems1);

```
