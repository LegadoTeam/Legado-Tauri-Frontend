<div align="center">


  # Legado Tauri

  **跨平台桌面阅读应用** — 基于 Tauri v2 + Vue 3 + Rust 构建

  [![Tauri](https://img.shields.io/badge/Tauri-v2-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://v2.tauri.app)
  [![Vue](https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white)](https://vuejs.org)
  [![Rust](https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
  [![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

  [功能介绍](#-功能特性) •
  [快速开始](#-快速开始) •
  [项目结构](#-项目结构) •
  [参与贡献](#-参与贡献) •
  [书源开发](#-书源开发)

</div>

---

## ✨ 功能特性

<table>
<tr>
<td width="50%">

### 📚 书架管理
- 追读书籍集中管理
- 按书名 / 作者快速搜索
- 章节阅读器，沉浸式阅读体验

</td>
<td width="50%">

### 🔍 多源发现 & 搜索
- 从多个书源浏览推荐内容
- 跨书源聚合搜索
- 智能书源能力检测

</td>
</tr>
<tr>
<td>

### 📄 书源系统
- **JavaScript 脚本驱动**，灵活可扩展
- 内置代码编辑器（Monaco Editor），实时调试
- 在线仓库一键安装，书源管理轻松自如

</td>
<td>

### 🔌 插件扩展
- 扩展脚本系统，高度可定制
- 内置示例代码库，快速上手
- 按分类管理，即装即用

</td>
</tr>
<tr>
<td>

### 🎨 精致 UI
- Naive UI 组件库打造现代界面
- CSS Grid 响应式布局，桌面 / 移动端自适应
- 可折叠侧边栏，自定义主题色

</td>
<td>

### ⚡ 高性能 & 安全
- Rust 后端保障原生级性能
- Boa JS 引擎沙箱执行，安全隔离
- 多层超时保护，防止脚本失控

</td>
</tr>
</table>

## 🛠 技术栈

| 层 | 技术 | 说明 |
|:---:|---|---|
| **前端** | Vue 3 + TypeScript | Composition API + `<script setup>` |
| **UI** | Naive UI 2 | 全局注册，开箱即用 |
| **编辑器** | Monaco Editor | 离线 Worker，完整 IDE 体验 |
| **桌面壳** | Tauri 2 (Rust) | 原生性能，跨平台打包 |
| **JS 引擎** | Boa Engine | 安全沙箱执行书源脚本 |
| **构建** | Vite 6 + vue-tsc | 极速 HMR 开发体验 |
| **包管理** | pnpm | 高效依赖管理 |

## 🚀 快速开始

### 环境要求

| 工具 | 版本 |
|---|---|
| [Node.js](https://nodejs.org) | >= 18 |
| [pnpm](https://pnpm.io) | >= 8 |
| [Rust](https://rustup.rs) | stable (2021 edition) |
| [Tauri CLI](https://v2.tauri.app/start/prerequisites/) | v2 |

### 安装 & 运行

```bash
# 1. 克隆仓库
git clone https://github.com/AoEiuV020/Legado_Tauri.git
cd Legado_Tauri

# 2. 安装前端依赖
pnpm install

# 3. 启动开发模式（前端 + Tauri 桌面应用）
pnpm run dev:tauri
```

### 构建发布

```bash
# Windows
pnpm run build:windows

# 通用构建（自动检测平台）
pnpm run build:tauri

# Android（需要配置 JDK 17）
pnpm run build:android
```

## 📁 项目结构

```
Legado_Tauri/
├── src/                          # 前端源码
│   ├── App.vue                   #   根组件，CSS Grid 布局
│   ├── main.ts                   #   入口：Naive UI + Monaco Worker 配置
│   ├── style.css                 #   全局 CSS 变量 & 设计令牌
│   ├── views/                    #   页面视图
│   │   ├── BookshelfView.vue     #     书架
│   │   ├── BookSourceView.vue    #     书源管理（安装/仓库/调试）
│   │   ├── ExploreView.vue       #     发现
│   │   ├── ExtensionsView.vue    #     插件管理
│   │   ├── HistoryView.vue       #     历史
│   │   └── SettingsView.vue      #     设置
│   ├── components/               #   组件
│   │   ├── layout/               #     布局组件（TitleBar/SideBar/TaskBar）
│   │   ├── BookSourceEditorModal.vue  # Monaco 书源编辑器
│   │   └── ScriptDialog.vue      #     扩展脚本对话框
│   └── composables/              #   组合式函数
│       ├── useBookSource.ts      #     书源 CRUD & 模板
│       ├── useExtension.ts       #     扩展管理
│       └── useScriptBridge.ts    #     脚本桥接
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs                #     命令注册入口
│   │   ├── booksource/           #     书源引擎（Boa JS / DOM / 加密）
│   │   ├── extension/            #     扩展系统
│   │   └── utils/                #     异步工具函数
│   ├── tauri.conf.json           #     Tauri 配置
│   └── Cargo.toml                #     Rust 依赖
├── booksources/                  # 示例书源文件
├── docs/                         # 开发文档
└── scripts/                      # 辅助脚本
```

## 📖 书源开发

书源是标准的 JavaScript 文件，通过注释头声明元数据：

```javascript
// @name        我的书源
// @version     1.0.0
// @author      你的名字
// @url         https://example.com
// @description 书源简介

function search(keyword, page) {
  const html = legado.http.get(`https://example.com/search?q=${keyword}&page=${page}`);
  const doc = legado.dom.parse(html);
  // ... 解析搜索结果
}
```

**内置宿主 API**：

| API | 说明 |
|---|---|
| `legado.http.get/post()` | HTTP 请求 |
| `legado.dom.parse()` | HTML DOM 解析 (CSS 选择器) |
| `legado.base64Encode/Decode()` | Base64 编解码 |
| `legado.md5()` / `legado.sha256()` | 哈希函数 |
| `legado.aesEncrypt/Decrypt()` | AES 加解密 |
| `legado.config.read/write()` | 持久化配置读写 |
| `legado.log()` / `legado.toast()` | 日志与通知 |

> 📄 完整 API 文档请参阅 [docs/booksource.md](docs/booksource.md)

## 🤝 参与贡献

欢迎任何形式的贡献！无论是提交 Bug 报告、功能建议还是代码贡献。

### 开发流程

1. **Fork** 本仓库
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m "feat: 添加某功能"`
4. 推送分支：`git push origin feature/my-feature`
5. 提交 **Pull Request**

### 开发规范

- 前端组件统一使用 `<script setup lang="ts">` 风格
- 优先使用 **Naive UI** 组件，保持视觉一致性
- Rust 新增命令需在 `lib.rs` 的 `generate_handler![]` 中注册
- 代码提交前请确保：
  - `pnpm vue-tsc --noEmit` — 无 TypeScript 类型错误
  - `cargo check`（src-tauri 目录下）— 无 Rust 编译错误

### 推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/)
  - [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
  - [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star 支持我们！**

</div>
