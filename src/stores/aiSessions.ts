import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AgentActivity, TestResult } from '@/composables/useAiAgent';
import {
  ensureFrontendNamespaceLoaded,
  getFrontendStorageItem,
  legacyLocalStorageGet,
  legacyLocalStorageRemove,
  onFrontendStorageChange,
  setFrontendStorageItem,
} from '@/composables/useFrontendStorage';

// ── 数据类型（继承自 useAiSessions）─────────────────────────────────────

export interface AiDraft {
  version: number;
  createdAt: number;
  fileName: string;
  content: string;
  testResults: TestResult[];
}

export interface AiSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mode: 'new' | 'modify';
  baseSourceFileName?: string;
  baseSourceCode?: string;
  currentFileName: string;
  currentSourceCode: string;
  activities: AgentActivity[];
  testResults: TestResult[];
  conversationHistory: unknown[];
  drafts: AiDraft[];
  status: 'idle' | 'tested_ok' | 'tested_fail' | 'saved';
}

// ── 存储键 ────────────────────────────────────────────────────────────────
const STORAGE_NAMESPACE = 'ai.sessions';
const SESSIONS_KEY = 'sessions';
const CURRENT_SESSION_KEY = 'currentId';
const LEGACY_SESSIONS_KEY = 'legado_ai_sessions_v2';
const LEGACY_CURRENT_SESSION_KEY = 'legado_ai_current_session_v2';
const MAX_SESSIONS = 20;
const MAX_ACTIVITIES_PER_SESSION = 200;
const MAX_DRAFTS_PER_SESSION = 10;
const MAX_CONV_MESSAGES = 40;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadAllSessions(): AiSession[] {
  try {
    const raw = getFrontendStorageItem(STORAGE_NAMESPACE, SESSIONS_KEY);
    if (raw) return JSON.parse(raw) as AiSession[];
  } catch {
    // ignore
  }
  return [];
}

function persistAllSessions(list: AiSession[]): void {
  try {
    const trimmed = list.map((s) => ({
      ...s,
      activities: s.activities.slice(-MAX_ACTIVITIES_PER_SESSION),
      conversationHistory: s.conversationHistory.slice(-MAX_CONV_MESSAGES),
    }));
    setFrontendStorageItem(STORAGE_NAMESPACE, SESSIONS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export const useAiSessionsStore = defineStore('aiSessions', () => {
  const sessions = ref<AiSession[]>(loadAllSessions());
  const currentSessionId = ref<string>(
    getFrontendStorageItem(STORAGE_NAMESPACE, CURRENT_SESSION_KEY) ?? '',
  );

  // 校验 currentId 有效性
  if (currentSessionId.value && !sessions.value.find((s) => s.id === currentSessionId.value)) {
    currentSessionId.value = sessions.value[0]?.id ?? '';
  }

  const currentSession = computed<AiSession | null>(
    () => sessions.value.find((s) => s.id === currentSessionId.value) ?? null,
  );

  function initialize() {
    void ensureFrontendNamespaceLoaded(STORAGE_NAMESPACE, () => {
      const migrated: Record<string, string> = {};
      const legacySessions = legacyLocalStorageGet(LEGACY_SESSIONS_KEY);
      const legacyCurrentId = legacyLocalStorageGet(LEGACY_CURRENT_SESSION_KEY);
      if (legacySessions) {
        migrated[SESSIONS_KEY] = legacySessions;
        legacyLocalStorageRemove(LEGACY_SESSIONS_KEY);
      }
      if (legacyCurrentId) {
        migrated[CURRENT_SESSION_KEY] = legacyCurrentId;
        legacyLocalStorageRemove(LEGACY_CURRENT_SESSION_KEY);
      }
      return Object.keys(migrated).length ? migrated : null;
    }).then(() => {
      sessions.value = loadAllSessions();
      currentSessionId.value = getFrontendStorageItem(STORAGE_NAMESPACE, CURRENT_SESSION_KEY) ?? '';
    });

    onFrontendStorageChange(({ namespace }) => {
      if (namespace !== STORAGE_NAMESPACE) return;
      sessions.value = loadAllSessions();
      currentSessionId.value = getFrontendStorageItem(STORAGE_NAMESPACE, CURRENT_SESSION_KEY) ?? '';
    });
  }

  function createSession(
    mode: 'new' | 'modify' = 'new',
    base?: { fileName: string; code: string },
  ): AiSession {
    const now = Date.now();
    const baseName = base?.fileName.replace(/\.js$/, '') ?? '';
    const session: AiSession = {
      id: generateId(),
      name: mode === 'modify' && baseName ? `修改《${baseName}》` : '新建书源草稿',
      createdAt: now,
      updatedAt: now,
      mode,
      baseSourceFileName: base?.fileName,
      baseSourceCode: base?.code,
      currentFileName: '',
      currentSourceCode: '',
      activities: [],
      testResults: [],
      conversationHistory: [],
      drafts: [],
      status: 'idle',
    };
    sessions.value.unshift(session);
    if (sessions.value.length > MAX_SESSIONS) {
      sessions.value = sessions.value.slice(0, MAX_SESSIONS);
    }
    persistAllSessions(sessions.value);
    selectSession(session.id);
    return session;
  }

  function selectSession(id: string): void {
    currentSessionId.value = id;
    setFrontendStorageItem(STORAGE_NAMESPACE, CURRENT_SESSION_KEY, id);
  }

  function updateSession(id: string, patch: Partial<Omit<AiSession, 'id' | 'createdAt'>>): void {
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx === -1) return;
    sessions.value[idx] = {
      ...sessions.value[idx],
      ...patch,
      updatedAt: Date.now(),
    };
    persistAllSessions(sessions.value);
  }

  function deleteSession(id: string): void {
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (currentSessionId.value === id) {
      const next = sessions.value[0]?.id ?? '';
      currentSessionId.value = next;
      setFrontendStorageItem(STORAGE_NAMESPACE, CURRENT_SESSION_KEY, next);
    }
    persistAllSessions(sessions.value);
  }

  function addDraftSnapshot(
    sessionId: string,
    fileName: string,
    content: string,
    testResults: TestResult[],
  ): void {
    const idx = sessions.value.findIndex((s) => s.id === sessionId);
    if (idx === -1) return;
    const session = sessions.value[idx];
    const prevVersion = session.drafts[session.drafts.length - 1]?.version ?? 0;
    const snapshot: AiDraft = {
      version: prevVersion + 1,
      createdAt: Date.now(),
      fileName,
      content,
      testResults: [...testResults],
    };
    const newDrafts = [...session.drafts, snapshot].slice(-MAX_DRAFTS_PER_SESSION);

    const defaultNames = ['新建书源草稿'];
    const shouldRename = defaultNames.includes(session.name) || session.name.startsWith('修改《');
    const newName = shouldRename && fileName ? fileName.replace(/\.js$/, '') : session.name;

    sessions.value[idx] = {
      ...session,
      currentFileName: fileName,
      currentSourceCode: content,
      testResults: [...testResults],
      drafts: newDrafts,
      name: newName,
      status: testResults.every((r) => r.pass) ? 'tested_ok' : 'tested_fail',
      updatedAt: Date.now(),
    };
    persistAllSessions(sessions.value);
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    initialize,
    createSession,
    selectSession,
    updateSession,
    deleteSession,
    addDraftSnapshot,
  };
});
