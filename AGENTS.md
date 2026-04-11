# Legado Tauri — 项目指南

基于 Tauri v2 + Vue 3 + TypeScript 构建的桌面阅读应用。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 (Composition API + `<script setup>`) + TypeScript |
| UI 组件库 | Naive UI 2 |
| 代码编辑器 | Monaco Editor（`monaco-editor` + `@guolao/vue-monaco-editor`） |
| 构建 | Vite 6、vue-tsc |
| 桌面壳 | Tauri 2（Rust） |
| 包管理 | pnpm |

## 项目结构

```
src/
  style.css                        # 全局 CSS 变量 & Reset
  main.ts                          # 入口：挂载 App + 配置 Monaco Worker（离线）
  App.vue                          # 根组件，CSS Grid 整体布局
  vite-env.d.ts                    # Vite 类型声明
  assets/
    booksource-default.svg         # 书源默认图标
  data/
    extensionExamples.ts           # 扩展示例数据
  components/
    layout/
      TitleBar.vue                 # 标题栏（顶部全宽）
      SideBar.vue                  # 菜单栏（左侧，可折叠）
      TaskBar.vue                  # 任务栏（右侧内容区底部）
      MainContent.vue              # 主内容区容器
      BottomNav.vue                # 移动端底部导航
      MobileDebugFloat.vue         # 移动端调试浮窗
    BookSourceEditorModal.vue      # Monaco 书源代码编辑弹窗
    ScriptDialog.vue               # 扩展脚本对话框
    BookSourceDocs.vue             # 书源开发文档组件
    bookshelf/
      ShelfBookCard.vue            # 书架书卡组件
    explore/
      BookCard.vue                 # 书籍卡片
      BookDetailDrawer.vue         # 书籍详情抽屉
      ChapterReaderModal.vue       # 章节阅读弹窗
      ExploreHtmlRenderer.vue      # HTML 发现页 iframe 渲染
      SourceExploreSection.vue     # 单书源发现分区
      SourceSearchGroup.vue        # 搜索结果书源分组
    reader/
      ReaderTopBar.vue             # 阅读器顶栏
      ReaderBottomBar.vue          # 阅读器底栏
      ReaderSettingsPanel.vue      # 阅读设置面板
      ReaderTocPanel.vue           # 目录面板
      types.ts                     # 阅读器公共类型（ReaderBookInfo, FlipMode 等）
      composables/
        useGesture.ts              # 手势识别（滑动 / 点击区域）
        usePagination.ts           # 分页计算
        useReaderSettings.ts       # 阅读器设置状态
      modes/                       # 翻页模式组件
        ScrollMode.vue             # 滚动模式
        SlideMode.vue              # 滑动翻页
        SimulationMode.vue         # 仿真翻页
        CoverMode.vue              # 覆盖翻页
        NoneMode.vue               # 无动画翻页
        ComicMode.vue              # 漫画模式
    docs/
      BookSourceDocs.vue           # 书源文档入口
      sections.ts                  # 文档章节定义
      examples/                    # 书源 API 示例代码（*.js）
  composables/
    useAppConfig.ts                # ⭐ 应用级全局配置管理（单例，优先使用）
    useBookSource.ts               # 书源 CRUD + BookSourceMeta 接口 + 模板生成
    useBookshelf.ts                # 书架 CRUD 响应式状态（全局单例）
    useEnv.ts                      # 运行环境检测（isTauri, isMobile, platform）
    useExploreBridge.ts            # HTML 发现页 iframe ↔ Vue 双向通信桥梁
    useExtension.ts                # 扩展脚本 CRUD + ExtensionMeta 接口
    useInvoke.ts                   # Tauri invoke 超时保护封装（invokeWithTimeout）
    useNavigation.ts               # 视图导航状态（activeView, navigateToSearch）
    useScriptBridge.ts             # Boa JS ↔ Rust ↔ Vue 双向调用桥梁（全局单例）
    useSourceCapabilities.ts       # 书源能力检测（search/explore/toc/content）& 开关管理
  views/
    BookshelfView.vue              # 书架
    BookSourceView.vue             # 书源管理（已安装 / 在线仓库 / 调试）
    ExploreView.vue                # 发现页
    ExtensionsView.vue             # 扩展管理
    HistoryView.vue                # 历史记录
    LogView.vue                    # 独立日志查看器（按类型/书源过滤、HTTP 详情面板）
    SearchView.vue                 # 全局搜索（多书源并发搜索）
    SettingsView.vue               # 设置（使用 useAppConfig）
src-tauri/
  src/
    lib.rs                         # Tauri generate_handler![] 注册入口 + run() + run_cli()
    main.rs                        # Rust 入口
    app_config.rs                  # ⭐ 应用级全局配置（AppConfig 单例 + Tauri 命令 + getter）
    cli.rs                         # CLI 模式书源测试（search/info/toc/content/explore/all）
    booksource/
      mod.rs                       # BookSourceMeta 结构体、parse_meta、CRUD 命令
      engine.rs                    # Boa JS 引擎、inject_legado_api、标准书源调用命令
      builtins.rs                  # 编解码、哈希、加解密等工具函数注入
      dom.rs                       # HTML DOM 解析 & CSS 选择器（scraper，legado.dom.*）
      image_api.rs                 # 图片处理 API（legado.image.*：解码/裁剪/拼接/编码）
      comic.rs                     # 漫画图片下载 & 本地缓存 & processImage 回调
    bookshelf/
      mod.rs                       # 书架持久化（ShelfBook CRUD + 隐私标记 + 章节目录 + 正文缓存）
    extension/
      mod.rs                       # ExtensionMeta（UserScript 格式）+ CRUD 命令
    script_bridge.rs               # dialog / REPL UI 桥接命令
    script_config.rs               # 脚本配置持久化（字符串 + 字节数组，scope 隔离）
    utils/
      mod.rs                       # 路径工具、安全校验、异步执行、任务取消注册表
    watcher.rs                     # 文件系统监听（书源 & 扩展目录变动推送事件）
  tauri.conf.json
  Cargo.toml
docs/
  booksource.md                    # 书源系统详细文档
scripts/
  probe/                           # 书源自动探针工具（详见 scripts/probe/README.md）
  tfcli/                           # TaskFlow CLI 工具
```

## 布局模型

CSS Grid 双列三行：

```
grid-template-areas:
  "title   title"
  "sidebar main"
  "sidebar taskbar"
```

CSS 自定义属性（`src/style.css`）：
- `--titlebar-h` `--taskbar-h` `--sidebar-w` `--sidebar-collapsed-w`
- `--color-*` `--space-*` `--radius-*` `--transition-*`

## 全局配置系统（app_config）

> **⭐ 优先使用**：所有可配置的应用级参数（HTTP UA、超时、UI 开关等）**必须**通过 `app_config` 管理，禁止 hardcode。

### 架构

```
Rust 后端                                     Vue 前端
┌─────────────────────────┐                  ┌──────────────────────────┐
│ app_config.rs            │  ← Tauri IPC → │ useAppConfig.ts           │
│ ┌─────────────────────┐ │                  │ ┌──────────────────────┐ │
│ │ AppConfig (struct)   │ │  get_all        │ │ config (ref)         │ │
│ │ APP_CONFIG (Mutex)   │ │  set / reset    │ │ setConfig / reset    │ │
│ │ getter 函数           │ │                  │ │ computed getters     │ │
│ └─────────────────────┘ │                  │ └──────────────────────┘ │
│ ↓ 持久化                │                  │                          │
│ <AppDataDir>/           │                  │                          │
│   app_config.json       │                  │                          │
└─────────────────────────┘                  └──────────────────────────┘
```

### 使用方式

**前端**（Vue 组件中）：
```ts
import { useAppConfig } from '@/composables/useAppConfig'
const { config, setConfig, resetConfig, engineTimeoutSecs } = useAppConfig()
```

**Rust 后端**（其他模块中同步读取）：
```rust
use crate::app_config::{get_http_user_agent, get_engine_timeout_secs};
let ua = get_http_user_agent();
let timeout = get_engine_timeout_secs();
```

### 当前配置项

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `http_user_agent` | String | Chrome 120 UA | HTTP 请求默认 User-Agent |
| `http_follow_redirects` | bool | true | 是否跟随重定向 |
| `http_connect_timeout_secs` | u64 | 10 | HTTP 连接超时（秒） |
| `engine_timeout_secs` | u64 | 30 | 书源脚本执行总超时（秒） |
| `comic_cache_enabled` | bool | true | 漫画图片是否经 Rust 下载缓存（false = 前端直接加载 URL） |
| `ui_show_debug_float` | bool | true | 是否显示调试浮窗 |
| `ui_layout_mode` | String | `auto` | 布局模式：`auto` / `mobile` / `desktop` |
| `ui_theme` | String | `auto` | UI 主题模式：`auto` / `light` / `dark` |
| `ui_sideload_debug_url` | String | 空字符串 | 侧载调试页地址，仅允许 `localhost` / 本机回环 / 局域网 IP |

### 扩展方式

新增配置项只需 3 步：
1. 在 `AppConfig` 结构体中添加带 `#[serde(default = "...")]` 的字段
2. 在 `app_config_set` / `app_config_reset` 的 `match` 中添加分支；提供对应 `get_xxx()` getter
3. 在 `useAppConfig.ts` 的 `AppConfig` 接口中添加对应字段

### 与 script_config 的区别

| | app_config | script_config |
|---|---|---|
| 定位 | 应用级全局设置 | 脚本级键值持久化 |
| 存储 | 单文件 `app_config.json` | 按 scope 隔离 `<scope>.json` |
| 读取方式 | Rust getter / 前端 composable | Tauri 命令 + scope 参数 |
| 典型场景 | HTTP UA、超时、UI 开关 | 书源/扩展的自定义配置数据 |

## 书源系统

> **按需读取**：仅在开发书源相关功能时阅读，日常开发无需加载。
>
> 详见 [docs/booksource.md](docs/booksource.md)

## 图片处理 API（legado.image.*）

向 Boa 引擎注入的图片处理能力，让书源具备基本的图片解码、裁剪、拼接、编码功能。句柄格式 `"I123"`，`thread_local!` 存储，引擎调用结束后自动清理。

| 函数 | 说明 |
|------|------|
| `legado.image.decode(base64)` | 解码 base64 图片数据 → 句柄 |
| `legado.image.create(w, h)` | 创建空白 RGBA 图片 → 句柄 |
| `legado.image.width(handle)` | 获取图片宽度 |
| `legado.image.height(handle)` | 获取图片高度 |
| `legado.image.crop(handle, x, y, w, h)` | 裁剪区域 → 新句柄 |
| `legado.image.paste(dest, src, x, y)` | 将 src 粘贴到 dest 的 (x,y) |
| `legado.image.encode(handle, format?)` | 编码为 base64（默认 jpg，支持 png/gif/webp） |
| `legado.image.free(handle)` | 释放单个句柄 |

### processImage 回调

漫画书源可定义 `function processImage(base64Data, pageIndex, imageUrl)` 函数。  
当图片缓存模式开启时，`comic.rs` 下载每张图片后自动检测并调用此回调：

- 书源定义了 `processImage` → 使用独立 OS 线程 + Boa 引擎逐页处理
- 未定义 → 保持原有轻量异步下载路径
- 返回 base64 字符串 → 保存处理后的图片；返回 null → 保持原始图片

典型用途：图片解密还原（如 JM 分割打乱还原）、水印移除等。

## 异步执行架构

所有涉及 Boa JS 引擎执行或文件 IO 的 Tauri 命令均为 **async** 函数，内部使用 `run_blocking_with_timeout()` 将阻塞操作移至独立线程执行并施加超时限制，避免阻塞主进程：

- **`utils::run_blocking_with_timeout(secs, closure)`**：核心异步工具，使用自定义 32MB 栈大小线程 + `catch_unwind` + `tokio::time::timeout`
- **`utils::run_blocking_cancellable(secs, cancel_rx, closure)`**：可取消版本，配合 `register_task` / `cancel_task` 实现前端取消
- **Boa 运行时安全限制**：所有 `Context::default()` 创建后需配置 `set_loop_iteration_limit(1_000_000)` / `set_stack_size_limit(1024)` / `set_recursion_limit(512)`
- **前端超时保护**：`src/composables/useInvoke.ts` 提供 `invokeWithTimeout()`，所有 Tauri invoke 调用均经此封装
- **超时层级**：Boa 运行时限制（防死循环）→ tokio timeout（防整体超时）→ 前端 Promise.race（最后兜底）
- **任务取消**：`TASK_REGISTRY` 全局注册表，前端调用 `booksource_cancel(taskId)` 可中止正在执行的任务

> **超时值来源**：书源引擎调用超时统一从 `app_config::get_engine_timeout_secs()` 读取，不再 hardcode。章节列表为引擎超时 × 4。

| 操作类型 | 后端超时 | 前端超时 |
|---------|---------|---------|
| 书源引擎调用（search/bookInfo/explore 等） | `engine_timeout_secs`（默认 30s） | 35s |
| 书源章节列表（chapterList，多页翻页） | `engine_timeout_secs × 4`（默认 120s） | 125s |
| 书源 eval / REPL | 15s | 20s |
| js_eval 调试 | 10s | 15s |
| 文件 CRUD（list/read/save/delete） | 5-10s | 10-15s |

## 前端开发规范

- **优先使用 Naive UI 组件**：按钮、输入框、弹窗、表单、列表、图标等，首选 Naive UI 提供的组件，不重复造轮子
- Naive UI 已在 `main.ts` 全局注册，直接在模板中使用 `<n-xxx>` 系列标签，无需逐个 import
- 仅在 Naive UI 无对应组件、或需要高度定制化时，才使用自定义组件
- 自定义组件样式优先沿用 `src/style.css` 中的 CSS 变量，保持视觉一致性
- 前端代码要组件化，尽可能将代码写成独立的组件以增加可维护性
- **Monaco Editor**：已在 `main.ts` 完成 Worker 配置，直接使用 `<VueMonacoEditor>` 即可，无需重复配置

## 约定

- **应用级配置优先使用 `app_config`**：所有可配置参数（超时、UA、开关等）必须通过 `app_config` 管理，前端用 `useAppConfig()`，Rust 用 `app_config::get_xxx()`
- 前端与 Rust 通信使用 `invoke()` 调用 `#[tauri::command]` 函数
- 前端组件统一使用 `<script setup lang="ts">` 风格
- Rust 侧新增命令需在 `lib.rs` 的 `generate_handler![]` 中注册
- 应用标识符：`com.legado_tauri`
- 涉及到项目架构常用的内容补充更新到 AGENTS.md，方便后续 AI 开发
- 设计所有功能都需要充分考虑到扩展脚本能够兼容，扩展脚本能接管大部分功能来实现高扩展性

## 书源探针工具（scripts/probe）

> **按需使用**：仅在开发新书源或调试网站结构时使用。

基于 2058 条书源规则频率分析，自动探测小说网站结构（搜索 / 书籍信息 / 章节目录 / 正文内容 / DOM 结构），支持自动生成书源 JS 脚本。

### 快速使用

```bash
cd scripts/probe

# 全流程探测
python probe.py http://www.16kbook.co/42_42889/

# 单模块探测
python probe.py <url> --only info|toc|content|search

# 自动生成书源 JS（探测 + 生成一步到位）
python probe.py <url> --generate --name "书源名称"

# 生成 AI 辅助提示词（信息不足时配合大模型分析）
python probe.py <url> --prompt

# JSON 输出（方便管道处理）
python probe.py <url> --json
```

### 模块结构

| 文件 | 功能 |
|------|------|
| `probe.py` | 主入口，编排全流程 |
| `probe_search.py` | 搜索表单 & URL 模式探测 |
| `probe_info.py` | 书籍信息探测（OG meta → 关键字 → DOM 回退） |
| `probe_toc.py` | 章节目录探测（关键字 / 已知 ID / class / 暴力搜索 + 分页检测） |
| `probe_content.py` | 正文容器探测（段落提取 / 噪声过滤 / 多页拼接） |
| `probe_dom.py` | DOM 结构精简摘要 |
| `gen_booksource.py` | 根据探测结果自动生成书源 JS |
| `prompt_gen.py` | AI 辅助提示词生成 |
| `fetcher.py` | HTTP 抓取 + HTML 清洗 |
| `report.py` | 终端彩色输出 + JSON 报告 |

> 详细参数与工作流见 [scripts/probe/README.md](scripts/probe/README.md)

## CLI 书源测试（src-tauri/src/cli.rs）

命令行模式下测试书源的各项功能，不启动 GUI：

```bash
# 测试全部功能
cargo run -- booksource-test --source 书源名称 --all --keyword "斗破苍穹"

# 测试单项
cargo run -- booksource-test --source 书源名称 --search --keyword "关键字"
cargo run -- booksource-test --source 书源名称 --info --book-url "书籍URL"
cargo run -- booksource-test --source 书源名称 --toc --book-url "书籍URL"
cargo run -- booksource-test --source 书源名称 --content --chapter-url "章节URL"
cargo run -- booksource-test --source 书源名称 --explore
```

输出格式：每项测试显示结构化结果 + ✅/❌ 状态汇总。

## 任务追踪

本项目任务追踪统一使用 **TaskFlow** 管理,简称`tf`，任务状态与上下文以 **TaskFlow** 为唯一来源，不在 AGENTS.md 中手动维护任务进度。

- 当前 TaskFlow 工作区：`read`（开源阅读）
- 当前 TaskFlow 项目：`APP`（开源阅读）
- 仓库内置 CLI 包目录：`scripts/tfcli`
- 仓库内置 CLI 调用入口：`python -m scripts.tfcli`
- 执行任务前先读取对应 TaskFlow 任务节点上下文，再开始实现
- 查询任务、读取节点、状态流转、追加正文与评论，统一通过 MCP TaskFlow 工具操作
- 默认状态键：`TODO` / `DOING` / `REVIEW` / `DONE`
- 默认状态标签：`TODO` = 待处理，`DOING` = 进行中，`REVIEW` = 待评审，`DONE` = 已完成
- 当前工作区标签：`API`、`Bug`、`UI`、`性能`、`文档`、`重构`
- 默认优先级：`P0` / `P1` / `P2` / `P3`
- 使用任务 key（如 `APP-2`）标识节点，禁止使用内部 UUID
- 涉及乐观锁的原子写操作必须携带 `version`
- 状态变更优先使用 `set_task_status` / `complete_task`，`update_tasks` 仅用于非原子字段
- 常用 MCP 工具：`list_unreplied_nodes`、`list_tasks`、`get_node`、`create_tasks`、`update_tasks`、`append_task_content`、`add_reply`、`set_task_status`、`complete_task`、`get_system_status`

## 任务完成后的强制检查（Quick Check）

**每次完成任何代码修改任务后，如修改到相应模块则必须执行以下检查，全部通过才算任务完成：**

1. **前端类型检查**：`pnpm vue-tsc --noEmit` — 无 TS 类型错误
2. **Rust 编译检查**：`cargo check`（在 `src-tauri/` 目录下）— 无编译错误无警告
3. **IDE 诊断检查**：调用 `get_errors` 工具 — 无 Vue/TS 报错 **必选**

一旦发现错误，立即修复后重新检查，直到全部通过。

## **注意**

这个项目要极其考虑代码可维护性可读性，代码要有极强健壮性。
