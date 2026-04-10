import { createApp } from 'vue'
import naive from 'naive-ui'
import './style.css'
import App from './App.vue'

// ── Monaco Editor Worker 配置（Vite 原生 ?worker 方案，离线可用）──────────────
import { loader } from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_: string, label: string): Worker {
    if (label === 'json') return new jsonWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}
// 使用本地 monaco 实例，不走 CDN
loader.config({ monaco })
// ──────────────────────────────────────────────────────────────────────────────

createApp(App).use(naive).mount('#app')
