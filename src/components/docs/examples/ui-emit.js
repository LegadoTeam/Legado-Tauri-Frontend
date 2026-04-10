// ─── 推送加载进度 ────────────────────────────────────────────────
function toc(tocUrl) {
  const chapters = []
  const totalPages = 5

  for (let p = 1; p <= totalPages; p++) {
    legado.ui.emit('progress', {
      current: p,
      total:   totalPages,
      hint:    '正在加载目录第 ' + p + ' 页...',
    })

    const resp = legado.http.get(tocUrl + '?page=' + p)
    const list = JSON.parse(resp).list ?? []
    list.forEach(ch => chapters.push({ name: ch.title, url: ch.url }))
  }

  legado.ui.emit('progress', {
    current: totalPages,
    total:   totalPages,
    hint:    '目录加载完成，共 ' + chapters.length + ' 章',
  })

  return chapters
}

// ─── 推送自定义事件 ──────────────────────────────────────────────
legado.ui.emit('custom:login-required', { redirectUrl: 'https://example.com/login' })
legado.ui.emit('custom:vip-content',    { chapterUrl, price: 2 })

// ─── 前端监听示例（Vue 组件中）──────────────────────────────────
// import { listen } from '@tauri-apps/api/event'
//
// const unlisten = await listen('script:ui', (event) => {
//   const { event: evtName, data } = event.payload
//   if (evtName === 'progress') {
//     console.log('进度:', data.current, '/', data.total, data.hint)
//   }
//   if (evtName === 'custom:login-required') {
//     // 弹出登录对话框
//   }
// })
