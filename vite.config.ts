import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
// import Components from 'unplugin-vue-components/vite';
// import AutoImport from 'unplugin-auto-import/vite';
// import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';

const host = process.env.TAURI_DEV_HOST;
const hasHost = typeof host === 'string' && host.length > 0;
const devHost = hasHost ? host : '0.0.0.0';
const buildTarget = process.env.LEGADO_BUILD_TARGET;
const isHarmonyBuild = buildTarget === 'harmony';

// https://vite.dev/config/
export default defineConfig(() => ({
  base: isHarmonyBuild ? './' : '/',
  plugins: [
    tailwindcss(),
    vue(),
    // Naive UI 按需自动导入组件（消除全量 app.use(naive) 的开销）
    // Components({
    //   resolvers: [NaiveUiResolver()],
    //   // 仅处理 src 目录
    //   dirs: ['src/components', 'src/views'],
    //   dts: 'src/components.d.ts',
    // }),
    // // Vue自动导入
    // AutoImport({
    //   imports: ['vue'],
    //   dts: 'src/auto-imports.d.ts',
    //   dtsMode: 'overwrite',
    //   // 不覆盖 eslint globals，只生成类型
    //   vueTemplate: true,
    // }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      'vue',
      '@tauri-apps/api/core',
      '@tauri-apps/api/event',
      '@tauri-apps/api/window',
      '@tauri-apps/api/webviewWindow',
    ],
  },
  build: {
    assetsInlineLimit: isHarmonyBuild ? Number.MAX_SAFE_INTEGER : undefined,
    cssCodeSplit: !isHarmonyBuild,
    modulePreload: isHarmonyBuild ? false : undefined,
    rollupOptions: {
      output: {
        inlineDynamicImports: isHarmonyBuild ? true : undefined,
        manualChunks: isHarmonyBuild
          ? undefined
          : function manualChunks(id: string): string | undefined {
              // vue + naive-ui 合并：naive 依赖 vue 内部 API，必须同 chunk 初始化
              if (
                id.includes('node_modules/naive-ui') ||
                id.includes('node_modules/vue') ||
                id.includes('node_modules/@vue')
              ) {
                return 'vendor-vue-naive';
              }
              if (id.includes('node_modules/@vicons')) {
                return 'vendor-icons';
              }
              if (id.includes('node_modules/@tauri-apps')) {
                return 'vendor-tauri';
              }
              return undefined;
            },
      },
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: devHost,
    hmr: hasHost
      ? {
          protocol: 'ws',
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
        './src/composables/**/*.ts',
      ],
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: [
        '**/src-tauri/**',
        '**/booksources/**',
        '**/notes/**',
        '**/scripts/**',
        '**/dist/**',
      ],
    },
  },
}));
