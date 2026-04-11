// [BOOT] 前端入口打点：记录 JS 开始执行的时间，用于切割 Android 52s 启动空档
const _bootT0 = Date.now()
console.log(`[BOOT][Frontend] main.ts 开始执行 t=${_bootT0}`)

import { createApp } from 'vue'
import naive from 'naive-ui'
import './style.css'
import App from './App.vue'

const app = createApp(App)
app.use(naive)
// 挂载后记录首屏到达时间
app.mount('#app')
console.log(`[BOOT][Frontend] App 挂载完成 cost=${Date.now() - _bootT0}ms`)
