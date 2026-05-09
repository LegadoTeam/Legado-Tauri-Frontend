// ==UserScript==
// @name         夜间风格背景包
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  注册多种夜读背景，包括蓝黑、霓虹网格和星雾风格
// @author       designer_x
// @category     主题风格
// @match        *
// @grant        none
// @run-at       document-start
// @enabled      false
// ==/UserScript==

legado.registerPlugin({
  id: 'reader-background-night-pack',
  backgrounds: [
    {
      id: 'midnight-blue',
      name: '午夜蓝',
      description: '深蓝底色加柔和冷光',
      preview: {
        backgroundColor: '#0f172a',
        backgroundImage:
          'radial-gradient(circle at 25% 20%, rgba(96,165,250,0.25) 0, transparent 24%)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        textColor: '#dbeafe',
      },
      resolve: function () {
        return {
          backgroundColor: '#0f172a',
          textColor: '#dbeafe',
          selectionColor: '#274472',
          backgroundImage:
            'radial-gradient(circle at 25% 20%, rgba(96,165,250,0.16) 0, transparent 24%), radial-gradient(circle at 78% 82%, rgba(59,130,246,0.12) 0, transparent 20%)',
          backgroundSize: 'cover, cover',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'no-repeat, no-repeat',
        };
      },
    },
    {
      id: 'neon-grid',
      name: '霓虹网格',
      description: '轻度科技感的暗色阅读背景',
      preview: {
        backgroundColor: '#090d18',
        backgroundImage:
          'linear-gradient(90deg, rgba(34,211,238,0.18) 0 1px, transparent 1px), linear-gradient(0deg, rgba(34,211,238,0.18) 0 1px, transparent 1px)',
        backgroundSize: '14px 14px, 14px 14px',
        backgroundRepeat: 'repeat, repeat',
        textColor: '#e0f2fe',
      },
      resolve: function () {
        return {
          backgroundColor: '#090d18',
          textColor: '#e0f2fe',
          selectionColor: '#164e63',
          backgroundImage:
            'linear-gradient(90deg, rgba(34,211,238,0.08) 0 1px, transparent 1px), linear-gradient(0deg, rgba(34,211,238,0.08) 0 1px, transparent 1px), radial-gradient(circle at 18% 20%, rgba(14,165,233,0.18) 0, transparent 22%)',
          backgroundSize: '22px 22px, 22px 22px, cover',
          backgroundPosition: 'center, center, center',
          backgroundRepeat: 'repeat, repeat, no-repeat',
        };
      },
    },
    {
      id: 'aurora-night',
      name: '极光夜',
      description: '蓝紫渐层和雾状高光',
      preview: {
        backgroundColor: '#10131f',
        backgroundImage:
          'linear-gradient(135deg, rgba(99,102,241,0.28) 0%, transparent 55%), linear-gradient(225deg, rgba(56,189,248,0.18) 0%, transparent 48%)',
        backgroundSize: 'cover, cover',
        backgroundRepeat: 'no-repeat, no-repeat',
        textColor: '#eef2ff',
      },
      resolve: function () {
        return {
          backgroundColor: '#10131f',
          textColor: '#eef2ff',
          selectionColor: '#3730a3',
          backgroundImage:
            'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, transparent 55%), linear-gradient(225deg, rgba(56,189,248,0.14) 0%, transparent 48%), radial-gradient(circle at 70% 18%, rgba(255,255,255,0.06) 0, transparent 18%)',
          backgroundSize: 'cover, cover, cover',
          backgroundPosition: 'center, center, center',
          backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
        };
      },
    },
  ],
});
