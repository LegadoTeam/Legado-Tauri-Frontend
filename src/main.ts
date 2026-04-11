// [BOOT] 前端入口打点：记录 JS 开始执行的时间，用于切割 Android 52s 启动空档
const _bootT0 = Date.now()
console.log(`[BOOT][Frontend] main.ts 开始执行 t=${_bootT0}`)

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Naive UI 已通过 unplugin-vue-components 按需自动导入，无需全量 app.use(naive)
const app = createApp(App)
// 挂载后记录首屏到达时间，并移除骨架屏
app.mount('#app')
console.log(`[BOOT][Frontend] App 挂载完成 cost=${Date.now() - _bootT0}ms`)

// 隐藏首屏骨架屏（过渡动画后移除）
const skeleton = document.getElementById('app-skeleton')
if (skeleton) {
  skeleton.classList.add('hidden')
  skeleton.addEventListener('transitionend', () => skeleton.remove(), { once: true })
}
