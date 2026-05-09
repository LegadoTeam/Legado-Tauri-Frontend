// ==UserScript==
// @name         深海蓝主题
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  提供一套偏蓝的沉静阅读主题，适合夜读和科技感界面
// @author       designer_x
// @category     主题风格
// @match        *
// @grant        none
// @run-at       document-start
// @enabled      false
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-theme-blue-ocean',
  themes: [
    {
      id: 'blue-ocean',
      name: '深海蓝',
      description: '偏蓝的沉静主题，适合夜读和科技感界面',
      preview: {
        backgroundColor: '#0f1b2d',
        textColor: '#dbeafe',
        selectionColor: '#355b8c',
      },
      resolve: function () {
        return {
          backgroundColor: '#0f1b2d',
          textColor: '#dbeafe',
          selectionColor: '#355b8c',
          styleVars: {
            '--reader-text-shadow': '0 1px 2px rgba(15, 23, 42, 0.25)',
          },
        };
      },
    },
  ],
});
