# CF Add Training

Electron 应用，用来把 Codeforces 题目一键拉进训练比赛（Mashup），并推送到指定的小组 Gym。它结合了手动登录（绕过人机验证）、官方公开 API，以及必要的会话内请求，来保障自动化流程稳定可靠。

## 功能亮点

- **手动绕过防刷**：通过内置 WebView 登录 Codeforces，用户亲自通过人机认证，应用自动保存 `persist:authsession` 下的全部 Cookie。
- **加密凭据**：GUI 中保存的账号密码会写入 `config.yaml`，使用 AES-256-CBC 对密码进行对称加密。
- **可视化选题**：在 `setProblem.html` 中设置题目数与分值区间（支持多道题不同区间），应用将自动使用 Codeforces `problemset.problems` API 获取候选题。
- **精准匹配 problemId**：拿到 contestId/index 后，再用会话内的 `/data/mashup` `problemQuery` 接口换取真实的 `problemId`，确保最终提交的数据与网页版一致。
- **一键发布**：自动调用 Mashup 创建接口得到新的 contestId，并把它加入勾选的小组（`https://codeforces.com/group/<id>/contests/add`）。

## 技术栈与目录

| 模块 | 说明 |
| --- | --- |
| Electron + TypeScript | 桌面端容器与主进程逻辑 |
| `src/main.ts` | BrowserWindow、持久化 session、IPC、CSRF 与 contest 发布 |
| `src/fetchGroups.ts` | 使用已登录 Cookie 抓取小组列表 HTML |
| `src/publicProblem.ts` | 调用 CF API、问题随机选择、problemQuery、Mashup 发布 |
| `src/preload.ts` | 在渲染进程暴露受限的 IPC 接口 |
| `public/*.html` | 登录、选择小组与配置题目的前端界面 |

## 工作流概览

1. **登录**：启动应用后加载 `public/login.html`，其中的 `<webview>` 打开 Codeforces。用户手动登录并通过人机认证。
2. **保存 Cookie**：点击“保存”按钮后，主进程调用 `session.fromPartition('persist:authsession')`，序列化 Cookie 到 `cookies/cookies.json`，并抓取 `https://codeforces.com/groups/my` 提取 CSRF 和可用小组列表。
3. **选择题目**：在 `setProblem.html` 中填写比赛名、时长、题目数以及每道题的 rating 区间。IPC 通知主进程后：
   - 使用 `problemset.problems` API 拉取完整题库并缓存 5 分钟；
   - 在每个区间内随机抽题，并避免重复；
   - 对每道 contestId/index 调用 `problemQuery`，拿到 `problemId`；
   - 构造符合 Mashup 要求的 `problemsJson` 并调用 `/data/mashup` 创建比赛。
4. **发布到小组**：记录下返回的 `newMashupContestId`，在“发布”动作中向选定小组的 `contests/add` 提交表单，把比赛加入该 Group 的 Mashup 列表。

## 环境要求

- Node.js ≥ 18
- Yarn ≥ 1.22（项目使用 `yarn` 脚本）
- 已注册的 Codeforces 账号，可访问目标小组并具有添加 Mashup 的权限
- Windows 系统（当前构建流程以 Windows 为主，其他平台需自行验证）

## 安装与运行

```bash
# 安装依赖
yarn install

# 编译 TypeScript（输出到 dist/）
yarn build

# 开发模式：先 build 再启动 Electron
yarn start

# 生成安装包（需 electron-builder 已配置的环境）
yarn dist
```

首次启动时，会自动在根目录生成 `config.yaml`（若不存在）。

## 使用指南

1. 打开应用后在 WebView 中完成 Codeforces 登录，必要时手动解决验证码/人机验证。
2. 点击界面上的“保存 Cookie”或同等按钮，让主进程同步 cookies、CSRF 以及小组列表。成功后会进入 `mygroup.html`，勾选希望推送的 Group。
3. 跳转到 `setProblem.html`：
   - 设置比赛名称与时长（分钟）；
   - 输入题目数量（1~99），再逐题配置分值区间（800~3500）；
   - 点击“设置题目难度范围”弹窗并确认，主进程会自动抽题、调用 API、并保存 contestId。
4. 确认小组选择，点击“开始发布”。如一切顺利，该 Mashup 会出现在对应 Group 的 “Contests → Mashups” 列表中。

> **提示**：若抽题或 problemQuery 失败，控制台会输出详细报错。可以调整分值区间或降低题目数量后重试。

## 配置与数据

| 文件 | 说明 |
| --- | --- |
| `config.yaml` | GUI 中保存的用户名/密码；密码字段经过 AES-256-CBC 加密 |
| `cookies/cookies.json` | 最近一次保存的浏览器 Cookie，供调试或备份使用 |
| `savedProblems/` | 可根据业务需要保存抽题结果（当前逻辑未使用，可自定义） |

> **安全注意**：`config.yaml` 与 `cookies/` 都包含敏感信息，请勿加入版本控制，也不要在公共环境中泄露。

## 开发与调试

- TypeScript 编译配置位于 `tsconfig.json`，目标 ES2020 + CommonJS。
- Electron 主进程开启了 `contextIsolation`，若需新增渲染进程能力，请通过 `preload.ts` 暴露受控 API。
- 可以使用开发者工具（`Ctrl+Shift+I`）调试前端界面；主进程日志会输出到终端。
- `publicProblem.ts` 中的 `loadProblemset()` 具备简单缓存，如需更频繁地刷新，可调整 `PROBLEMSET_CACHE_TTL`。

## 常见问题

| 问题 | 处理方式 |
| --- | --- |
| 登录后点击保存 Cookie 报错 `csrf_token` 为空 | 确保登录成功并访问过任一 Codeforces 页面，再次点击保存 |
| `problemQuery` 返回 `Unable to resolve problem` | 该 contestId/index 暂不可用，换一个 rating 区间或减少题目数量 |
| 发布到小组失败 | 检查当前账号是否拥有向该 Group 添加 Mashup 的权限，或确认 CSRF/会话未过期 |
| 编译失败 `node-gyp` | 确保 Node 版本 ≥18，且在 Windows 上安装好 `windows-build-tools` |

## 免责声明

本项目仅供学习与团队内部训练使用。请遵循 Codeforces 的使用条款，不要在未经允许的情况下批量创建/发布比赛；如账号触发风控，请第一时间暂停自动化操作。
