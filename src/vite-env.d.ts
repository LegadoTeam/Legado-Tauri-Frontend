/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Window {
  __LEGADO_SET_BOOT_STAGE?: (stage: string) => void;
  __LEGADO_SHOW_BOOT_ERROR?: (message: string) => void;
}

declare module 'opencc-js' {
  export function Converter(options: {
    from: 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';
    to: 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';
  }): (input: string) => string;
}
