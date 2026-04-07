# CF-Add-Training — 基于流量的自动化请求分析与构造工具

> 以 Burp Suite 流量捕获为起点，逆向分析 Codeforces 平台认证与业务接口，实现从 **请求截获 → 结构化解析 → 自动化批量构造** 的全链路工具化。

---

## 项目背景

在安全测试与渗透评估过程中，Burp Suite 是捕获、分析 HTTP/HTTPS 流量的核心工具。本项目源于一次对 Codeforces 平台的**授权安全测试**：通过 Burp Suite Proxy 拦截并分析其登录认证、CSRF Token 签发、Mashup 比赛创建等关键业务流程的请求报文，提炼出完整的接口调用链，最终将分析成果封装为可复用的桌面自动化工具。

**核心价值：** 将 Burp Suite 中"一次性"的流量分析经验，沉淀为可持续运行的程序化资产。

---

## 技术路线

```
┌─────────────┐  抓包分析   ┌──────────────┐  结构化映射   ┌────────────────┐
│ Burp Suite  │ ──────────▶ │ 接口逆向文档  │ ──────────▶  │ 自动化请求引擎  │
│ (流量捕获)   │            │ (请求/响应)   │             │ (Electron/TS)  │
└─────────────┘            └──────────────┘             └────────────────┘
```

### 阶段一：流量捕获与分析（Burp Suite）

利用 Burp Suite Proxy 对 Codeforces 平台进行全链路流量拦截，重点关注：

| 分析目标 | Burp Suite 功能 | 输出成果 |
|---|---|---|
| 登录认证流程 | Proxy → HTTP History 过滤 | 识别 Session Cookie 签发机制与 CSRF Token 生成规律 |
| 小组列表接口 | Repeater 手动重放验证 | 确认 `/groups/my` 接口的鉴权依赖与参数结构 |
| Mashup 创建流程 | Proxy + Repeater 联动 | 提取 `problemQuery` → `problemId` 的映射规则 |
| 反爬与人机验证 | Intercept 观察 302/JS 跳转 | 确定必须通过 WebView 模拟真实浏览器行为的节点 |

> **关键发现：** Codeforces 的 Mashup 发布接口依赖服务端签发的 `csrf_token`（32 位十六进制），该 Token 与用户 Session 绑定、嵌入 HTML 表单 `<input type="hidden">` 中，无法通过静态参数复用，必须在登录后从页面响应中动态提取。

### 阶段二：请求结构化与映射

将 Burp Suite 中捕获的原始请求报文，解构为程序可消费的结构化模板：

```typescript
// 从 Burp Repeater 中还原的请求结构示例
interface CapturedRequest {
  method: "POST";
  endpoint: "/data/mashup";
  headers: {
    "X-Csrf-Token": string;    // 动态，需登录后从页面 HTML 提取
    "Cookie": string;          // 由 Electron session 管理模块注入
    "X-Requested-With": "XMLHttpRequest";
  };
  body: {
    action: "saveMashup" | "problemQuery";
    contestName: string;
    contestDuration: number;
    problemsJson: string;      // 由 problemQuery 接口逐题转换得到
    csrf_token: string;        // 与 header 中的 X-Csrf-Token 双重校验
  };
}
```

### 阶段三：自动化请求引擎

基于 Electron + TypeScript 构建桌面工具，封装从认证到发布的完整请求链：

```
src/
├── main.ts              # 主进程：Cookie 持久化、IPC 调度、CSRF 管理、发布到小组
├── fetchGroups.ts       # 自动化获取用户小组列表（对应 Burp 分析的 GET 接口）
├── publicProblem.ts     # 抽题 + problemQuery + Mashup 发布（对应 Burp 分析的 POST 接口链）
├── preload.ts           # 渲染进程安全桥接（contextIsolation）
public/
├── login.html           # WebView 登录页（绕过人机验证环节）
├── mygroup.html         # 小组选择界面（解析并渲染 group 列表 HTML）
├── setProblem.html      # 题目配置界面（设置比赛参数与 rating 区间）
```

---

## 核心能力

### 1. 流量驱动的接口逆向

- 通过 Burp Suite Proxy 捕获 Codeforces 平台 **4 个关键业务端点** 的请求/响应报文
  - `GET /groups/my` — 获取小组列表（需鉴权）
  - `POST /data/mashup` `action=problemQuery` — 题目 ID 映射
  - `POST /data/mashup` `action=saveMashup` — 创建 Mashup 比赛
  - `POST /group/{id}/contests/add` — 推送比赛到指定小组
- 利用 Repeater 模块对接口进行参数变异测试，验证 `csrf_token` 校验逻辑
- 确认各接口对 `Cookie`、`Referer`、`X-Requested-With` 等请求头的依赖关系

### 2. 认证链自动化

- 通过 Electron `<webview>` 标签（`partition: "persist:authsession"`）模拟真实浏览器环境，手动完成人机验证
- 登录后自动从 `session.fromPartition()` 提取全部 Cookie，序列化到本地 `cookies/cookies.json`
- 从 `/groups/my` 页面 HTML 响应中通过正则 `/<input\s+type=['"]hidden['"]\s+name=['"]csrf_token['"]\s+value=['"]([a-f0-9]{32})['"]\s*\/?>/i` 动态提取 CSRF Token
- 后续所有 POST 请求自动注入 `Cookie` + `X-Csrf-Token` + `X-Requested-With` 三重认证头

### 3. 批量请求构造与发送

- 基于 Codeforces `problemset.problems` 公开 API 进行随机选题，支持按 Rating 区间（800~3500）筛选，内置 5 分钟缓存避免频繁调用
- 通过 `/data/mashup` 接口批量将 `contestId/index` 转换为服务端内部 `problemId`（逐题调用 `problemQuery`）
- 自动调用 `saveMashup` 创建 Mashup 比赛，并通过 `/group/{id}/contests/add` 推送到指定 Gym 小组
- 单次操作可替代 10+ 步手动流程

### 4. 安全存储

- 账号凭据使用 **AES-256-CBC** 加密存储于本地 `config.yaml`（密钥经 SHA-256 哈希派生）
- Session Cookie 隔离存储于 Electron `persist:authsession` 分区，不纳入版本控制
- 应用启用 `contextIsolation`，渲染进程通过 `preload.ts` 受限 IPC 桥接访问主进程能力

---

## 工具链

| 工具 | 角色 |
|---|---|
| **Burp Suite Professional** | 流量捕获、请求分析、参数变异、接口探测 |
| Electron | 桌面运行时容器，WebView 模拟真实浏览器 |
| TypeScript | 主逻辑开发语言 |
| Node.js (≥ 18) | 运行时环境，提供 `https` / `crypto` / `fs` 等底层能力 |
| Yarn (≥ 1.22) | 依赖管理 |

---

## 目录结构

```
cf_add_training/
├── src/
│   ├── main.ts              # Electron 主进程：窗口管理、IPC 调度、CSRF 提取、发布逻辑
│   ├── fetchGroups.ts       # HTTPS 请求构建与 HTML 解析（JSDOM 提取 group 列表）
│   ├── publicProblem.ts     # CF API 调用、随机选题、problemQuery、Mashup 创建
│   └── preload.ts           # contextIsolation 安全桥接层
├── public/
│   ├── login.html           # WebView 登录界面
│   ├── mygroup.html         # 小组选择界面（接收渲染后的 HTML 片段）
│   └── setProblem.html      # 比赛参数配置界面
├── package.json
├── tsconfig.json
└── yarn.lock
```

---

## 使用流程

```bash
# 1. 克隆项目
git clone https://github.com/xhit-ux/cf_add_training.git
cd cf_add_training

# 2. 安装依赖
yarn install

# 3. 启动应用（自动编译 TypeScript 并启动 Electron）
yarn start
```

### 操作步骤

1. **登录认证**：应用内置 WebView 打开 Codeforces，手动完成人机验证后点击"保存 Cookie"，程序自动提取 Cookie 序列化 + CSRF Token 提取。
2. **选择小组**：自动拉取用户所属的 Gym 小组列表，勾选目标小组。
3. **配置比赛**：设置比赛名称、时长、题目数量及每道题的 Rating 区间（800~3500）。
4. **一键发布**：工具自动完成 选题 → ID 转换（problemQuery） → Mashup 创建 → 推送小组 的全流程。

---

## 免责声明

本项目仅用于授权安全测试与团队内部训练，所有接口分析均在合法授权范围内进行。使用本工具需遵守 Codeforces 平台使用条款，禁止用于未授权的自动化操作或任何违反平台规则的行为。
