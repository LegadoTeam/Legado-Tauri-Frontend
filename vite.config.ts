import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from 'node:url'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    // Naive UI 按需自动导入组件（消除全量 app.use(naive) 的开销）
    Components({
      resolvers: [NaiveUiResolver()],
      // 仅处理 src 目录
      dirs: ['src/components', 'src/views'],
      dts: 'src/components.d.ts',
    }),
    // Vue/Naive UI composable 自动导入（useMessage, useDialog 等）
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar',
          ],
        },
      ],
      dts: 'src/auto-imports.d.ts',
      // 不覆盖 eslint globals，只生成类型
      vueTemplate: true,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  optimizeDeps: {
    include: [
      'vue',
      '@tauri-apps/api/core',
      '@tauri-apps/api/event',
      '@tauri-apps/api/window',
      '@tauri-apps/api/webviewWindow'
    ]
  },
  build: {
    // 减少首屏 JS 体积：将大型第三方库单独分包，利用浏览器并行解析
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/naive-ui')) return 'vendor-naive'
          if (id.includes('node_modules/vue')) return 'vendor-vue'
          if (id.includes('node_modules/@vicons')) return 'vendor-icons'
          if (id.includes('node_modules/@tauri-apps')) return 'vendor-tauri'
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    warmup: {
      clientFiles: [
        './src/main.ts',
        './src/App.vue',
        './src/views/**/*.vue',
        './src/components/**/*.vue',
        './src/composables/**/*.ts'
      ],
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: [
        "**/src-tauri/**",
        "**/booksources/**",
        "**/tmp-booksources/**",
        "**/notes/**",
        "**/scripts/**",
        "**/dist/**"
      ],
    },
  },
}));
