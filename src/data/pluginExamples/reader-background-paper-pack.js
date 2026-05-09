// ==UserScript==
// @name         纸张风格背景包
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  注册多种纸张、织物与古籍风格背景，适合浅色阅读主题
// @author       designer_x
// @category     主题风格
// @match        *
// @grant        none
// @run-at       document-start
// @enabled      false
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-background-paper-pack',
  backgrounds: [
    {
      id: 'warm-paper',
      name: '暖纸',
      description: '柔和的浅米色纸张和轻纸纹',
      preview: {
        backgroundColor: '#f6ecd8',
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(120,85,45,0.12) 0 1px, transparent 1px 12px)',
        backgroundSize: 'auto',
        backgroundRepeat: 'repeat',
        textColor: '#4b3726',
      },
      resolve: function () {
        return {
          backgroundColor: '#f6ecd8',
          textColor: '#4b3726',
          selectionColor: '#d8bf97',
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(120,85,45,0.08) 0 1px, transparent 1px 32px), radial-gradient(circle at 22% 18%, rgba(255,255,255,0.26) 0, transparent 26%)',
          backgroundSize: 'auto, cover',
          backgroundPosition: 'center top, center',
          backgroundRepeat: 'repeat, no-repeat',
        };
      },
    },
    {
      id: 'linen-fabric',
      name: '细麻布',
      description: '浅灰麻布纹理，适合现代简洁风',
      preview: {
        backgroundColor: '#f3f1ee',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 4px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 4px)',
        backgroundSize: '8px 8px, 8px 8px',
        backgroundRepeat: 'repeat, repeat',
        textColor: '#2f2c28',
      },
      resolve: function () {
        return {
          backgroundColor: '#f3f1ee',
          textColor: '#2f2c28',
          selectionColor: '#c7c1b6',
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 6px)',
          backgroundSize: '12px 12px, 12px 12px',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'repeat, repeat',
        };
      },
    },
    {
      id: 'bamboo-slip',
      name: '竹简',
      description: '模拟竹片编联的纵向底纹',
      preview: {
        backgroundColor: '#e8d8ac',
        backgroundImage:
          'repeating-linear-gradient(90deg, rgba(90,62,20,0.2) 0 2px, transparent 2px 10px)',
        backgroundSize: 'auto',
        backgroundRepeat: 'repeat',
        textColor: '#4a3515',
      },
      resolve: function () {
        return {
          backgroundColor: '#e8d8ac',
          textColor: '#4a3515',
          selectionColor: '#c8b07a',
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(90,62,20,0.12) 0 2px, transparent 2px 24px), linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 22%)',
          backgroundSize: 'auto, cover',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'repeat, no-repeat',
        };
      },
    },
  ],
});
