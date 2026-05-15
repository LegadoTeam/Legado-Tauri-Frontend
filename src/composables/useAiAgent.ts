/**
 * useAiAgent — AI 自动写书源 Agent
 *
 * 架构：
 *   前端 → Vercel AI SDK streamText（OpenAI 兼容 API）→ 多步工具调用循环
 *   工具调用 → 现有 Tauri 命令（listBookSources / readBookSource / saveBookSource /
 *              evalBookSource / booksource_search / booksource_book_info 等）
 *
 * 配置存储：Rust 暴露的前端命名空间存储
 * 支持任意 OpenAI 兼容端点（OpenAI / 智谱 / DeepSeek / Ollama / 本地 LLM 等）
 *
 * 注意：AI SDK v6 使用 inputSchema（而非 parameters），且流式部分属性已更名：
 *   text-delta  → part.text      (非 textDelta)
 *   tool-call   → part.input     (非 args)
 *   tool-result → part.output    (非 result)
 *   start-step  → 替代 onStepStart 回调
 *
 * 会话集成：与 useAiSessions.ts 配合实现持久化多轮对话：
 *   - runAiAgent 接受 options.sessionId，运行结束后自动持久化会话状态
 *   - options.continueConversation=true 时，从会话中加载历史消息，实现多轮对话
 *   - 每次 save_source 工具调用后自动触发 addDraftSnapshot 创建版本快照
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, stepCountIs, type ModelMessage } from 'ai';
import { reactive } from 'vue';
import { z } from 'zod';
import { useAiSessionsStore } from '@/stores';
import {
  listBookSources,
  readBookSource,
  evalBookSource,
  type BookSourceMeta,
} from './useBookSource';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageGet,
  legacyLocalStorageRemove,
  setFrontendStorageItem,
} from './useFrontendStorage';
import { invokeWithTimeout } from './useInvoke';

// ── 配置类型 ──────────────────────────────────────────────────────────────

export interface AiConfig {
  /** API 基地址，例如 https://api.openai.com/v1 */
  apiUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 模型名称，例如 gpt-4o / deepseek-chat */
  model: string;
  /** 最大工具调用轮次（stepCountIs 参数），防止死循环，默认 30 */
  maxSteps: number;
  /**
   * 请求模式:
   * - `chat`    → /v1/chat/completions（兼容大多数第三方接口：MiniMax、DeepSeek、Ollama 等）
   * - `responses` → /v1/responses（OpenAI 原生 Responses API，仅适用于官方 OpenAI）
   * 默认 chat
   */
  apiMode: 'chat' | 'responses';
  /** 采样温度，可选，留空表示使用模型默认値 */
  temperature?: number;
  /** 单次调用最大输出 Token，可选，留空表示不限制 */
  maxTokens?: number;
}

const CONFIG_NAMESPACE = 'ai.agent';
const CONFIG_STORAGE_KEY = 'config';

function defaultAiConfig(): AiConfig {
  return {
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o',
    maxSteps: 30,
    apiMode: 'chat',
  };
}

function parseAiConfig(raw: string | null): AiConfig {
  if (!raw) {
    return defaultAiConfig();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      apiUrl: parsed.apiUrl ?? 'https://api.openai.com/v1',
      apiKey: parsed.apiKey ?? '',
      model: parsed.model ?? 'gpt-4o',
      maxSteps: parsed.maxSteps ?? 30,
      apiMode: parsed.apiMode ?? 'chat',
      temperature: parsed.temperature,
      maxTokens: parsed.maxTokens,
    };
  } catch {
    return defaultAiConfig();
  }
}

export function loadAiConfig(): AiConfig {
  return parseAiConfig(getFrontendStorageItem(CONFIG_NAMESPACE, CONFIG_STORAGE_KEY));
}

export function saveAiConfig(cfg: AiConfig): void {
  setFrontendStorageItem(CONFIG_NAMESPACE, CONFIG_STORAGE_KEY, JSON.stringify(cfg));
}

export async function ensureAiConfigLoaded(): Promise<AiConfig> {
  await ensureFrontendNamespaceLoaded(CONFIG_NAMESPACE, () => {
    const legacy = legacyLocalStorageGet('legado_ai_agent_config');
    if (!legacy) {
      return null;
    }
    legacyLocalStorageRemove('legado_ai_agent_config');
    return { [CONFIG_STORAGE_KEY]: legacy };
  });
  return loadAiConfig();
}

// ── 活动日志类型 ───────────────────────────────────────────────────────────

export type ActivityType =
  | 'thinking' // AI 正在推理（流式文本）
  | 'tool_call' // AI 发起工具调用（含参数，完成后显示返回值）
  | 'message' // AI 最终回复
  | 'error' // 错误
  | 'info'; // 系统信息

export interface AgentActivity {
  id: number;
  type: ActivityType;
  /** 主要文字内容（思考文本 / 错误信息 / 系统通知） */
  content: string;
  /** 工具名称（tool_call 类型时有效） */
  toolName?: string;
  /** 工具调用参数（JSON 字符串，tool_call 时有效） */
  args?: string;
  /** 工具执行结果（JSON/文本，tool_call 完成后填充） */
  result?: string;
  timestamp: number;
}

// ── 测试结果类型 ──────────────────────────────────────────────────────────

export type TestStatus = 'pending' | 'ok' | 'error';

export interface TestResult {
  name: string;
  status: TestStatus;
  output: string;
}

// ── 系统提示词 ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `你是 **Legado Tauri 书源制作助手**，专门帮助用户制作可在 Legado Tauri 阅读器中运行的书源 JS 文件。

## 运行环境约束（严格遵守）

**运行引擎**：Boa JS 引擎（ES5 only）

**硬性禁止**（会导致运行时错误）：
- \`let\` / \`const\` / 箭头函数 \`=>\` / \`class\` / Promise / \`async\`/\`await\`
- 模板字符串（反引号）
- 展开运算符 \`...\` / 解构赋值
- 浏览器全局对象：\`document\` / \`window\` / \`fetch\` / \`XMLHttpRequest\`

**必须使用**：\`var\` / 普通函数 / 字符串拼接 / \`legado.*\` 宿主 API

## 书源文件骨架

\`\`\`js
// @name        书源名称
// @version     1.0.0
// @author      作者
// @url         https://主站域名
// @type        novel          // novel | comic | video
// @enabled     true
// @tags        标签1,标签2
// @description 简短描述

var BASE = 'https://主站域名';

function search(keyword, page) {}        // 返回 BookItem[]
function bookInfo(bookUrl) {}            // 返回 BookItem（含 tocUrl）
function chapterList(tocUrl) {}          // 返回 ChapterInfo[]（必须正序）
function chapterContent(chapterUrl) {}   // 小说→文本 漫画→JSON图片数组 视频→URL
function explore(page, category) {}     // 可选
\`\`\`

## 可用宿主 API（I/O 宿主能力均为异步，请使用 await）

\`\`\`js
// HTTP
var html = await legado.http.get(url, headers?);
var html = await legado.http.post(url, body, headers?);
var results = await legado.http.batchGet(urlArray);
var resp = await fetch(url, init?);
var params = new URLSearchParams({ q: keyword });
var form = new FormData();

// DOM
var doc  = legado.dom.parse(html);
var el   = legado.dom.select(doc, 'css selector');
var els  = legado.dom.selectAll(doc, 'css selector');
var txt  = legado.dom.text(el);
var val  = legado.dom.attr(el, 'href');
var htm  = legado.dom.html(el);
legado.dom.remove(doc, '.ad');
var txt   = legado.dom.selectText(doc, 'sel');
var txts  = legado.dom.selectAllTexts(doc, 'sel');
var attrs = legado.dom.selectAllAttrs(doc, 'sel', 'href');

// 工具
legado.log(msg);
var enc = encodeURIComponent(str);
var enc = legado.urlEncodeCharset(str, 'GBK');
var b64 = legado.base64Encode(str);
var str = legado.base64Decode(b64);
var dec = await legado.aesDecrypt(data, key, iv, 'CBC');
var h   = await legado.md5(str);
\`\`\`

## 数据结构

\`\`\`
BookItem:   { name, author, bookUrl, coverUrl, kind, lastChapter?, latestChapter?, latestChapterUrl?, wordCount?, chapterCount?, updateTime?, status?, tocUrl? }
ChapterInfo:{ name, url, group? }   // group 仅视频多线路需要
\`\`\`

搜索、发现、详情页都可以返回这些 BookItem 元数据；只提取当前页面或接口已直接提供的数据，不要为了补齐字数、章节数、状态、更新时间而在列表页逐本请求详情页。

## 工作流程（严格顺序）

1. **探测**：用 eval_in_source 工具在书源引擎中执行 ES5 代码发起 HTTP 请求，获取目标网站 HTML 结构
2. **分析**：分析 HTML，确定 URL 规律、列表选择器、正文容器等
3. **编写**：写出完整书源代码（ES5），用 save_source 保存
4. **测试**：按 explore → bookInfo → chapterList → chapterContent → search 顺序测试
5. **迭代**：根据错误修复代码并重新保存→测试，直到通过

## 注意事项

- 每次改代码后必须 save_source 保存，才能生效
- eval_in_source 的代码必须用 ES5 写法（var、普通函数）
- 漫画源：chapterContent 返回 JSON.stringify(imageUrlArray)
- 视频源（苹果 CMS）：vod_play_url 字段用 $$$分线路，#分集，$分集名和URL
- 多页目录用 batchGet 并发获取
- 每个函数开头必须打 legado.log() 调试日志
- 文件名格式：书源名.js（不含路径）

现在等待用户描述目标网站，开始工作！`;
}

// ── 工具定义（AI SDK v6：inputSchema 替代 parameters）────────────────────

/**
 * @param sessionId 当前会话 ID，save_source 时用于创建版本快照
 */
function buildTools(sessionId?: string) {
  return {
    list_sources: tool({
      description: '列出所有已安装书源，返回书源名称、文件名、URL。用于了解已有书源结构以作参考。',
      inputSchema: z.object({}),
      execute: async (_input: Record<string, never>) => {
        const sources: BookSourceMeta[] = await listBookSources();
        return sources.map((s) => ({
          fileName: s.fileName,
          name: s.name,
          url: s.url,
          tags: s.tags,
          sourceType: s.sourceType,
        }));
      },
    }),

    read_source: tool({
      description: '读取指定书源的完整 JS 代码，用于参考已有书源的 ES5 实现方式。',
      inputSchema: z.object({
        fileName: z.string().describe('书源文件名（含 .js 后缀）'),
      }),
      execute: async ({ fileName }: { fileName: string }) => {
        return await readBookSource(fileName);
      },
    }),

    save_source: tool({
      description:
        '保存（新建或覆盖）书源 JS 文件。每次修改完代码后必须调用此工具保存，后续测试才能看到最新代码。fileName 只含文件名（如 "笔趣阁.js"），不含路径。',
      inputSchema: z.object({
        fileName: z.string().describe('书源文件名（含 .js 后缀）'),
        content: z.string().describe('完整的书源 JS 代码（必须是 ES5 写法）'),
      }),
      execute: async ({ fileName, content }: { fileName: string; content: string }) => {
        // 保存到草稿目录，不出现在已安装书源列表中
        await invokeWithTimeout('booksource_save_draft', { fileName, content }, 10_000);
        // 自动创建草稿版本快照
        if (sessionId) {
          useAiSessionsStore().addDraftSnapshot(sessionId, fileName, content, [
            ...state.testResults,
          ]);
        }
        return { success: true, fileName, savedBytes: content.length };
      },
    }),

    eval_in_source: tool({
      description:
        '在指定书源文件作用域中执行任意 JS 代码（ES5 写法），返回执行结果字符串。' +
        '可调用 legado.http.get/post、fetch 等 API 探测目标网站结构。' +
        '示例代码：var html = await legado.http.get("https://example.com"); return html.slice(0,3000);',
      inputSchema: z.object({
        fileName: z.string().describe('书源文件名（含 .js 后缀）。也可用任意已存在的书源文件名。'),
        code: z.string().describe('要执行的 JS 代码（可用 async/await，可用 legado.* API）'),
      }),
      execute: async ({ fileName, code }: { fileName: string; code: string }) => {
        return await evalBookSource(fileName, code);
      },
    }),

    test_search: tool({
      description:
        '调用已保存书源的 search(keyword, page) 函数，返回搜索结果。必须先 save_source 保存最新代码。',
      inputSchema: z.object({
        fileName: z.string().describe('书源文件名（含 .js 后缀）'),
        keyword: z.string().describe('搜索关键词'),
        page: z.number().optional().describe('页码（默认 1）'),
      }),
      execute: async ({
        fileName,
        keyword,
        page = 1,
      }: {
        fileName: string;
        keyword: string;
        page?: number;
      }) => {
        return await invokeWithTimeout<unknown>(
          'booksource_search',
          { fileName, keyword, page },
          35000,
        );
      },
    }),

    test_book_info: tool({
      description:
        '调用书源的 bookInfo(bookUrl) 函数，返回书籍详情（name/author/coverUrl/intro/tocUrl 等）。',
      inputSchema: z.object({
        fileName: z.string().describe('书源文件名'),
        bookUrl: z.string().describe('书籍详情页 URL（来自搜索结果）'),
      }),
      execute: async ({ fileName, bookUrl }: { fileName: string; bookUrl: string }) => {
        return await invokeWithTimeout<unknown>(
          'booksource_book_info',
          { fileName, bookUrl },
          35000,
        );
      },
    }),

    test_chapter_list: tool({
      description: '调用书源的 chapterList(tocUrl) 函数，返回章节目录数组（正序）。',
      inputSchema: z.object({
        fileName: z.string().describe('书源文件名'),
        bookUrl: z.string().describe('书籍/目录入口 URL'),
      }),
      execute: async ({ fileName, bookUrl }: { fileName: string; bookUrl: string }) => {
        return await invokeWithTimeout<unknown>(
          'booksource_chapter_list',
          { fileName, bookUrl, taskId: null },
          60000,
        );
      },
    }),

    test_chapter_content: tool({
      description:
        '调用书源的 chapterContent(chapterUrl) 函数，返回章节正文（小说→文本，漫画→图片 URL 数组 JSON，视频→播放地址）。',
      inputSchema: z.object({
        fileName: z.string().describe('书源文件名'),
        chapterUrl: z.string().describe('章节 URL（来自章节列表）'),
      }),
      execute: async ({ fileName, chapterUrl }: { fileName: string; chapterUrl: string }) => {
        return await invokeWithTimeout<unknown>(
          'booksource_chapter_content',
          { fileName, chapterUrl },
          35000,
        );
      },
    }),
  };
}

// ── 全局单例状态 ──────────────────────────────────────────────────────────

let _activityCounter = 0;

const state = reactive({
  activities: [] as AgentActivity[],
  isRunning: false,
  currentFileName: '',
  currentSourceCode: '',
  testResults: [] as TestResult[],
  /** 当前正在流式输出的思考条目 id（-1 表示无） */
  activeThinkingId: -1,
});

let _abortController: AbortController | null = null;

// ── 内部工具函数 ──────────────────────────────────────────────────────────

function addActivity(
  type: ActivityType,
  content: string,
  opts?: { toolName?: string; args?: string; result?: string },
): number {
  const id = ++_activityCounter;
  state.activities.push({
    id,
    type,
    content,
    toolName: opts?.toolName,
    args: opts?.args,
    result: opts?.result,
    timestamp: Date.now(),
  });
  // 防止列表过长（保留最近 300 条）
  if (state.activities.length > 300) {
    state.activities.splice(0, state.activities.length - 300);
  }
  return id;
}

function updateActivity(id: number, patch: Partial<AgentActivity>) {
  const idx = state.activities.findIndex((a) => a.id === id);
  if (idx !== -1) {
    state.activities[idx] = { ...state.activities[idx], ...patch };
  }
}

function upsertTestResult(name: string, status: TestStatus, output: string) {
  const idx = state.testResults.findIndex((r) => r.name === name);
  const entry: TestResult = { name, status, output };
  if (idx !== -1) {
    state.testResults[idx] = entry;
  } else {
    state.testResults.push(entry);
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 尝试从任意错误对象中提取可读错误信息。
 * 支持 AI SDK 的 APICallError、普通 Error、字符串、JSON 对象等。
 */
function formatError(err: unknown): string {
  if (!err) {
    return '未知错误';
  }
  if (typeof err === 'string') {
    return err || '未知错误';
  }

  const parts: string[] = [];

  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    // 常规 message
    if (typeof e['message'] === 'string' && e['message']) {
      parts.push(e['message']);
    }
    // AI SDK 标准字段
    if (typeof e['statusCode'] === 'number') {
      parts.push(`HTTP ${e['statusCode']}`);
    }
    if (typeof e['responseBody'] === 'string' && e['responseBody']) {
      const body = e['responseBody'].slice(0, 500);
      parts.push(`响应体: ${body}`);
    }
    // cause 链
    if (e['cause'] instanceof Error) {
      parts.push(`cause: ${e['cause'].message}`);
    } else if (typeof e['cause'] === 'string' && e['cause']) {
      parts.push(`cause: ${e['cause']}`);
    }
    // 最后兑当：如果什么都没得到，直接 JSON 序列化
    if (parts.length === 0) {
      try {
        const json = JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
        parts.push(json.slice(0, 800));
      } catch {
        parts.push(String(err));
      }
    }
  }

  return parts.join('\n') || '未知错误';
}

const TEST_TOOL_NAMES: Record<string, string> = {
  test_search: '搜索',
  test_book_info: '书籍详情',
  test_chapter_list: '章节目录',
  test_chapter_content: '章节正文',
};

// ── 主 Agent 函数 ─────────────────────────────────────────────────────────

export interface RunAiAgentOptions {
  /** 要写入的会话 ID，提供后自动持久化活动日志、测试结果、对话历史 */
  sessionId?: string;
  /**
   * 继续对话模式：true 时从会话中加载历史消息，不清空当前活动日志。
   * false（默认）时清空活动日志重新开始，对话历史仍追加到会话中。
   */
  continueConversation?: boolean;
}

export async function runAiAgent(
  config: AiConfig,
  userPrompt: string,
  options: RunAiAgentOptions = {},
): Promise<void> {
  if (state.isRunning) {
    throw new Error('Agent 正在运行中，请先停止');
  }

  const { sessionId, continueConversation = false } = options;

  state.isRunning = true;
  state.activeThinkingId = -1;
  _abortController = new AbortController();

  // 继续对话时：从会话恢复现有状态；全新任务时：清空
  let prevMessages: ModelMessage[] = [];
  if (sessionId) {
    const session = useAiSessionsStore().sessions.find((s) => s.id === sessionId);
    if (session) {
      if (continueConversation) {
        state.activities = [...session.activities];
        state.testResults = [...session.testResults];
        state.currentFileName = session.currentFileName;
        state.currentSourceCode = session.currentSourceCode;
        prevMessages = session.conversationHistory as ModelMessage[];
      } else {
        state.activities = [];
        state.testResults = [];
        state.currentFileName = session.currentFileName;
        state.currentSourceCode = session.currentSourceCode;
      }
    } else {
      state.activities = [];
      state.testResults = [];
      state.currentFileName = '';
      state.currentSourceCode = '';
    }
  } else {
    state.activities = [];
    state.testResults = [];
    state.currentFileName = '';
    state.currentSourceCode = '';
  }

  addActivity('info', continueConversation ? `继续对话：${userPrompt}` : `开始任务：${userPrompt}`);

  // 构建发送给模型的消息列表（历史 + 本次用户指令）
  const inputMessages: ModelMessage[] = [...prevMessages, { role: 'user', content: userPrompt }];

  try {
    const openaiProvider = createOpenAI({
      apiKey: config.apiKey || 'placeholder',
      baseURL: config.apiUrl.replace(/\/$/, ''),
    });

    // 根据 apiMode 选择请求路径：
    //   chat     → openaiProvider.chat(model)  → POST /v1/chat/completions
    //   responses → openaiProvider(model)         → POST /v1/responses
    const llmModel =
      (config.apiMode ?? 'chat') === 'responses'
        ? openaiProvider(config.model)
        : openaiProvider.chat(config.model);

    // toolCallId → 对应的 tool_call 活动 id（用于 tool-result 时回填）
    const toolCallActivityMap = new Map<string, number>();
    let hadStreamError = false;

    const result = streamText({
      model: llmModel,
      system: buildSystemPrompt(),
      messages: inputMessages,
      tools: buildTools(sessionId),
      stopWhen: stepCountIs(Math.max(1, config.maxSteps ?? 30)),
      abortSignal: _abortController.signal,
      ...(config.temperature !== null && config.temperature !== undefined
        ? { temperature: config.temperature }
        : {}),
      ...(config.maxTokens !== null && config.maxTokens !== undefined && config.maxTokens > 0
        ? { maxTokens: config.maxTokens }
        : {}),
    });

    for await (const part of result.fullStream) {
      if (_abortController.signal.aborted) {
        break;
      }

      if (part.type === 'start-step') {
        // 新推理步骤开始，创建思考条目
        state.activeThinkingId = addActivity('thinking', '');
      } else if (part.type === 'text-delta') {
        // 流式文字 delta（AI SDK v6：属性名为 text，非 textDelta）
        if (state.activeThinkingId !== -1) {
          const existing = state.activities.find((a) => a.id === state.activeThinkingId);
          updateActivity(state.activeThinkingId, {
            content: (existing?.content ?? '') + part.text,
          });
        } else {
          state.activeThinkingId = addActivity('thinking', part.text);
        }
      } else if (part.type === 'finish-step') {
        // 步骤结束，清除空思考条目
        if (state.activeThinkingId !== -1) {
          const existing = state.activities.find((a) => a.id === state.activeThinkingId);
          if (!existing?.content?.trim()) {
            const idx = state.activities.findIndex((a) => a.id === state.activeThinkingId);
            if (idx !== -1) {
              state.activities.splice(idx, 1);
            }
          }
          state.activeThinkingId = -1;
        }
      } else if (part.type === 'tool-call') {
        // 工具调用（AI SDK v6：input 是参数，非 args）
        const argsStr = safeJsonStringify(part.input);
        const actId = addActivity('tool_call', '', {
          toolName: part.toolName,
          args: argsStr,
        });
        toolCallActivityMap.set(part.toolCallId, actId);
      } else if (part.type === 'tool-result') {
        // 工具结果（AI SDK v6：output 是结果，非 result）
        const resultStr = safeJsonStringify(part.output);

        // 回填对应 tool_call 条目的 result 字段
        const actId = toolCallActivityMap.get(part.toolCallId);
        if (actId !== undefined) {
          updateActivity(actId, { result: resultStr });
        }

        // save_source → 更新代码预览
        if (part.toolName === 'save_source') {
          const inp = part.input as { fileName?: string; content?: string };
          if (inp.fileName) {
            state.currentFileName = inp.fileName;
          }
          if (inp.content) {
            state.currentSourceCode = inp.content;
          }
        }

        // 测试工具 → 记录测试结果
        const testName = TEST_TOOL_NAMES[part.toolName ?? ''];
        if (testName) {
          const out = part.output;
          const isError = out !== null && typeof out === 'object' && 'error' in out;
          upsertTestResult(testName, isError ? 'error' : 'ok', resultStr.slice(0, 3000));
        }
      } else if (part.type === 'error') {
        hadStreamError = true;
        addActivity('error', formatError(part.error));
      }
    }

    // 获取最终文字回复（多步后通常是总结性内容）
    let finalText = '';
    try {
      finalText = await result.text;
      if (finalText?.trim()) {
        addActivity('message', finalText);
      }
    } catch {
      // 忽略（aborted 等情况）
    }

    addActivity(
      'info',
      hadStreamError
        ? '任务因错误终止'
        : state.currentFileName
          ? `书源 "${state.currentFileName}" 创建/更新完成`
          : '任务完成',
    );

    // 持久化会话：保存活动日志、测试结果，并追加本轮对话历史
    if (sessionId) {
      let newHistory: ModelMessage[] = inputMessages;
      try {
        const response = await result.response;
        if (response && 'messages' in response && Array.isArray(response.messages)) {
          // AI SDK 返回本轮模型生成的消息（含工具调用），追加到对话历史
          newHistory = [...inputMessages, ...response.messages];
        } else {
          // 降级：只追加 AI 文字回复
          if (finalText?.trim()) {
            newHistory = [...inputMessages, { role: 'assistant', content: finalText }];
          }
        }
      } catch {
        // 降级处理
        if (finalText?.trim()) {
          newHistory = [...inputMessages, { role: 'assistant', content: finalText }];
        }
      }
      useAiSessionsStore().updateSession(sessionId, {
        activities: state.activities,
        testResults: state.testResults,
        currentFileName: state.currentFileName,
        currentSourceCode: state.currentSourceCode,
        conversationHistory: newHistory,
        status: hadStreamError ? 'tested_fail' : 'idle',
      });
    }
  } catch (e: unknown) {
    if (!_abortController?.signal.aborted) {
      addActivity('error', `Agent 运行出错：${formatError(e)}`);
    } else {
      addActivity('info', '已停止');
    }
    // 即使出错也持久化已有的活动日志
    if (sessionId) {
      useAiSessionsStore().updateSession(sessionId, {
        activities: state.activities,
        testResults: state.testResults,
        currentFileName: state.currentFileName,
        currentSourceCode: state.currentSourceCode,
      });
    }
  } finally {
    state.isRunning = false;
    state.activeThinkingId = -1;
    _abortController = null;
  }
}

export function stopAiAgent(): void {
  _abortController?.abort();
}

export function clearAgentState(): void {
  state.activities = [];
  state.testResults = [];
  state.currentFileName = '';
  state.currentSourceCode = '';
  state.activeThinkingId = -1;
}

// ── 导出 composable ───────────────────────────────────────────────────────

export function useAiAgent() {
  return {
    state,
    runAiAgent,
    stopAiAgent,
    clearAgentState,
    loadAiConfig,
    saveAiConfig,
  };
}
