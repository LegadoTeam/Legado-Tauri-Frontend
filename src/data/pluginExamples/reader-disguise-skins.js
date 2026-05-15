// ==UserScript==
// @name         阅读器伪装皮肤包
// @namespace    legado.reader.disguise.skins
// @version      0.2.0
// @description  为阅读器注册 Windows 记事本（深色/浅色）、Word 和 WPS 三套伪装皮肤，并可在阅读时同步切换应用主题
// @author       Legado
// @category     阅读器
// @match        *
// @grant        none
// @run-at       document-idle
// @enabled      true
// ==/UserScript==

function makeWindowVars(vars) {
  return {
    '--reader-body-top': vars.bodyTop,
    '--reader-body-right': vars.bodyRight,
    '--reader-body-bottom': vars.bodyBottom,
    '--reader-body-left': vars.bodyLeft,
    '--reader-body-max-width': vars.bodyMaxWidth,
    '--reader-body-margin': '0 auto',
    '--reader-body-surface': vars.bodySurface,
    '--reader-body-border': vars.bodyBorder,
    '--reader-body-shadow': vars.bodyShadow,
    '--reader-body-radius': vars.bodyRadius,
    '--reader-body-backdrop-filter': vars.bodyBackdropFilter ?? 'none',
    '--reader-top-top': vars.topTop,
    '--reader-top-left': vars.topInset,
    '--reader-top-right': vars.topInset,
    '--reader-top-max-width': vars.topMaxWidth,
    '--reader-top-margin': '0 auto',
    '--reader-top-radius': vars.topRadius,
    '--reader-top-border': vars.topBorder,
    '--reader-top-shadow': vars.topShadow,
    '--reader-top-bar-bg': vars.topBackground,
    '--reader-top-bar-color': vars.topColor,
    '--reader-top-bar-link-color': vars.topLinkColor,
    '--reader-bottom-bottom': vars.bottomBottom,
    '--reader-bottom-left': vars.bottomInset,
    '--reader-bottom-right': vars.bottomInset,
    '--reader-bottom-max-width': vars.bottomMaxWidth,
    '--reader-bottom-margin': '0 auto',
    '--reader-bottom-radius': vars.bottomRadius,
    '--reader-bottom-border': vars.bottomBorder,
    '--reader-bottom-shadow': vars.bottomShadow,
    '--reader-bottom-bar-bg': vars.bottomBackground,
    '--reader-bottom-bar-color': vars.bottomColor,
    '--reader-bottom-bar-accent': vars.bottomAccent,
  };
}

function makeNotepadVars(dark) {
  // 精仿 Windows 11 记事本
  // 标题栏 32px | 菜单栏 30px | 正文区 | 状态栏 26px
  var UI_FONT = '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", sans-serif';
  var MONO_FONT = '"Consolas", "Cascadia Mono", "Courier New", "Microsoft YaHei UI", monospace';

  // 颜色方案
  var c = dark
    ? {
        winBg: '#1c1c1c', // 整窗背景
        titleBg: '#1e1e1e', // 标题栏
        titleText: '#cccccc',
        titleBorder: 'none',
        menuBg: '#1c1c1c', // 菜单栏
        menuText: '#e0e0e0',
        menuSep: '1px solid #333333',
        contentBg: '#1c1c1c', // 正文区
        statusBg: '#1c1c1c', // 状态栏
        statusText: '#9d9d9d',
        statusBorder: '1px solid #2c2c2c',
        winCtrlColor: '#a0a0a0',
        dropdownBg: '#2c2c2c',
        dropdownBorder: '1px solid #454545',
        dropdownText: '#e8e8e8',
        dropdownShadow: '0 8px 24px rgba(0,0,0,0.55)',
        menuOverlay: 'rgba(0,0,0,0.5)',
      }
    : {
        winBg: '#ffffff',
        titleBg: '#f3f3f3',
        titleText: '#1e1e1e',
        titleBorder: '0 0 1px 0 solid #e5e5e5',
        menuBg: '#f3f3f3',
        menuText: '#1e1e1e',
        menuSep: '1px solid #e5e5e5',
        contentBg: '#ffffff',
        statusBg: '#f0f0f0',
        statusText: '#616161',
        statusBorder: '1px solid #e5e5e5',
        winCtrlColor: '#444444',
        dropdownBg: '#ffffff',
        dropdownBorder: '1px solid #e0e0e0',
        dropdownText: '#1e1e1e',
        dropdownShadow: '0 4px 16px rgba(0,0,0,0.14)',
        menuOverlay: 'rgba(0,0,0,0.2)',
      };

  return {
    // ─── 标题栏 (::before 伪元素) ──────────────────────────────────
    '--reader-shell-title-display': 'flex',
    '--reader-shell-title-text': '"  无标题 - 记事本"',
    '--reader-shell-title-height': '32px',
    '--reader-shell-title-bg': c.titleBg,
    '--reader-shell-title-color': c.titleText,
    '--reader-shell-title-padding': '0 12px',
    '--reader-shell-title-border': c.titleBorder,
    '--reader-shell-title-font': '13px/32px ' + UI_FONT,
    '--reader-shell-title-z-index': '20',
    // ─── 窗口控制按钮 (::after 伪元素，右对齐) ──────────────────────
    '--reader-shell-winctrls-display': 'flex',
    '--reader-shell-winctrls-text': '"  ─      □      ✕  "',
    '--reader-shell-winctrls-height': '32px',
    '--reader-shell-winctrls-bg': 'transparent',
    '--reader-shell-winctrls-color': c.winCtrlColor,
    '--reader-shell-winctrls-font': '11px/32px ' + UI_FONT,
    '--reader-shell-winctrls-z-index': '21',
    // ─── 遮罩层 ────────────────────────────────────────────────────
    '--reader-menu-overlay-bg': c.menuOverlay,
    // ─── 菜单栏 (top bar → "文件 编辑 查看") ──────────────────────
    '--reader-top-top': '32px',
    '--reader-top-left': '0px',
    '--reader-top-right': '0px',
    '--reader-top-max-width': 'none',
    '--reader-top-margin': '0',
    '--reader-top-height': '30px',
    '--reader-top-padding': '0 6px',
    '--reader-top-padding-top': '0',
    '--reader-top-radius': '0px',
    '--reader-top-border': 'none',
    '--reader-top-shadow': 'none',
    '--reader-top-bar-bg': c.menuBg,
    '--reader-top-bar-color': c.menuText,
    '--reader-top-bar-link-color': c.menuText,
    '--reader-top-bar-backdrop-filter': 'none',
    // 隐藏返回按钮和章节标题，只保留三点菜单按钮
    '--reader-top-back-display': 'none',
    '--reader-top-center-display': 'none',
    '--reader-top-more-display': 'inline-flex',
    // 菜单文字标签（左侧 "文件  编辑  查看"）
    '--reader-top-menu-label-display': 'flex',
    '--reader-top-menu-label-flex': '1 1 auto',
    '--reader-top-menu-label-text': '"  文件       编辑       查看"',
    '--reader-top-menu-label-font': '14px/30px ' + UI_FONT,
    '--reader-top-menu-label-color': c.menuText,
    // 下拉菜单样式
    '--reader-top-dropdown-top': '30px',
    '--reader-top-dropdown-right': '8px',
    '--reader-top-dropdown-min-width': '200px',
    '--reader-top-dropdown-bg': c.dropdownBg,
    '--reader-top-dropdown-border': c.dropdownBorder,
    '--reader-top-dropdown-radius': '8px',
    '--reader-top-dropdown-shadow': c.dropdownShadow,
    '--reader-top-dropdown-color': c.dropdownText,
    '--reader-top-dropdown-backdrop-filter': 'none',
    // ─── 正文区 ────────────────────────────────────────────────────
    '--reader-body-top': '62px', // 32px 标题栏 + 30px 菜单栏
    '--reader-body-right': '0px',
    '--reader-body-bottom': '26px', // 状态栏高度
    '--reader-body-left': '0px',
    '--reader-body-max-width': 'none',
    '--reader-body-margin': '0',
    '--reader-body-surface': c.contentBg,
    '--reader-body-border': 'none',
    '--reader-body-shadow': 'none',
    '--reader-body-radius': '0px',
    // ─── 状态栏 (bottom bar) ───────────────────────────────────────
    '--reader-bottom-bottom': '0px',
    '--reader-bottom-left': '0px',
    '--reader-bottom-right': '0px',
    '--reader-bottom-max-width': 'none',
    '--reader-bottom-margin': '0',
    '--reader-bottom-padding': '0 6px',
    '--reader-bottom-padding-bottom': '0',
    '--reader-bottom-direction': 'row',
    '--reader-bottom-gap': '0px',
    '--reader-bottom-radius': '0px',
    '--reader-bottom-border': c.statusBorder,
    '--reader-bottom-shadow': 'none',
    '--reader-bottom-bar-bg': c.statusBg,
    '--reader-bottom-bar-color': c.statusText,
    '--reader-bottom-bar-accent': dark ? '#ffffff' : '#0078d4',
    '--reader-bottom-bar-backdrop-filter': 'none',
    '--reader-bottom-progress-display': 'none',
    '--reader-bottom-actions-justify': 'flex-end',
    '--reader-bottom-actions-gap': '0px',
    '--reader-bottom-action-direction': 'row',
    '--reader-bottom-action-font-size': '12px',
    '--reader-bottom-action-padding': '3px 14px',
    '--reader-bottom-action-radius': '0px',
    // ─── 排版（模仿记事本默认字体 Consolas 11pt ≈ 15px） ──────────
    '--reader-padding': '8px 10px',
    '--reader-padding-top': '8px',
    '--reader-padding-right': '10px',
    '--reader-padding-bottom': '8px',
    '--reader-padding-left': '10px',
    '--reader-font-family': MONO_FONT,
    '--reader-font-size': '15px',
    '--reader-line-height': '1.5',
    '--reader-letter-spacing': '0px',
    '--reader-text-align': 'left',
    '--reader-text-indent': '0em',
    '--reader-paragraph-spacing': '0px',
  };
}

legado.registerPlugin({
  id: 'reader-disguise-skins',
  setup(api) {
    var appliedTheme = null;

    async function restoreAppTheme() {
      if (!appliedTheme) {
        return;
      }
      var t = appliedTheme;
      appliedTheme = null;
      await api.ui.setAppTheme(t);
    }

    async function syncAppTheme(session) {
      if (!api.settings.get('syncAppTheme', true)) {
        await restoreAppTheme();
        return;
      }
      var skinId = session?.appearance ? session.appearance.skinPresetId : '';
      var isNotepadDark = skinId === 'reader-disguise-skins:notepad';
      var isNotepadLight = skinId === 'reader-disguise-skins:notepad-light';
      var isWordWps =
        skinId === 'reader-disguise-skins:word' || skinId === 'reader-disguise-skins:wps';

      if (!isNotepadDark && !isNotepadLight && !isWordWps) {
        await restoreAppTheme();
        return;
      }
      appliedTheme ??= api.ui.getAppTheme();
      // 记事本深色 → dark；记事本浅色 / Word / WPS → light
      await api.ui.setAppTheme(isNotepadDark ? 'dark' : 'light');
    }

    var unlisten = api.reader.onSessionChange(function (session) {
      void syncAppTheme(session);
    });

    return {
      settings: {
        defaults: { syncAppTheme: true },
        schema() {
          return [
            {
              type: 'switch',
              key: 'syncAppTheme',
              label: '自动同步应用主题',
              description: '启用后，使用记事本皮肤时会自动切换软件深色/浅色主题，退出后恢复',
            },
          ];
        },
      },
      skins: [
        // ── Windows 11 记事本 深色 ────────────────────────────────
        {
          id: 'notepad',
          name: 'Windows 记事本（深色）',
          description: '100% 仿真 Windows 11 深色记事本，锁定上下滚动模式',
          category: '伪装皮肤',
          lockedFlipMode: 'scroll',
          preview: {
            backgroundColor: '#1c1c1c',
            textColor: '#d4d4d4',
            styleVars: {
              '--reader-top-bar-bg': '#1c1c1c',
              '--reader-body-surface': '#1c1c1c',
            },
          },
          resolve() {
            return {
              backgroundColor: '#1c1c1c',
              backgroundImage: 'none',
              textColor: '#d4d4d4',
              selectionColor: '#264f78',
              styleVars: makeNotepadVars(true),
            };
          },
        },
        // ── Windows 11 记事本 浅色 ────────────────────────────────
        {
          id: 'notepad-light',
          name: 'Windows 记事本（浅色）',
          description: '100% 仿真 Windows 11 浅色记事本，锁定上下滚动模式',
          category: '伪装皮肤',
          lockedFlipMode: 'scroll',
          preview: {
            backgroundColor: '#ffffff',
            textColor: '#1e1e1e',
            styleVars: {
              '--reader-top-bar-bg': '#f3f3f3',
              '--reader-body-surface': '#ffffff',
            },
          },
          resolve() {
            return {
              backgroundColor: '#ffffff',
              backgroundImage: 'none',
              textColor: '#1e1e1e',
              selectionColor: '#b5d7ff',
              styleVars: makeNotepadVars(false),
            };
          },
        },
        // ── Word 文档 ─────────────────────────────────────────────
        {
          id: 'word',
          name: 'Word 文档',
          description: '把阅读器改成深色工作台 + 居中白纸页面，接近 Word 编辑视图',
          category: '伪装皮肤',
          preview: {
            backgroundColor: '#2b579a',
            textColor: '#ffffff',
            styleVars: {
              '--reader-top-bar-bg': 'linear-gradient(180deg, #2f5fa8 0%, #1d447f 100%)',
              '--reader-body-surface': '#ffffff',
            },
          },
          resolve() {
            return {
              backgroundColor: '#1c3d6b',
              backgroundImage:
                'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 22%), linear-gradient(180deg, #2b579a 0%, #21467d 100%)',
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
              textColor: '#1f2937',
              selectionColor: '#bed3f7',
              styleVars: makeWindowVars({
                bodyTop: '86px',
                bodyRight: '136px',
                bodyBottom: '44px',
                bodyLeft: '136px',
                bodyMaxWidth: '920px',
                bodySurface: 'linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%)',
                bodyBorder: '1px solid rgba(15, 23, 42, 0.12)',
                bodyShadow: '0 30px 80px rgba(9, 30, 66, 0.28)',
                bodyRadius: '8px',
                topTop: '18px',
                topInset: '88px',
                topMaxWidth: '1016px',
                topRadius: '16px 16px 0 0',
                topBorder: '1px solid rgba(255, 255, 255, 0.08)',
                topShadow: '0 16px 30px rgba(6, 24, 52, 0.22)',
                topBackground: 'linear-gradient(180deg, #2e5ca5 0%, #153b73 100%)',
                topColor: '#f8fbff',
                topLinkColor: '#dbeafe',
                bottomBottom: '18px',
                bottomInset: '104px',
                bottomMaxWidth: '1016px',
                bottomRadius: '0 0 16px 16px',
                bottomBorder: '1px solid rgba(255, 255, 255, 0.06)',
                bottomShadow: '0 14px 26px rgba(8, 26, 58, 0.2)',
                bottomBackground: 'rgba(16, 42, 83, 0.88)',
                bottomColor: '#d8e6ff',
                bottomAccent: '#93c5fd',
              }),
            };
          },
        },
        // ── WPS 轻办公 ────────────────────────────────────────────
        {
          id: 'wps',
          name: 'WPS 轻办公',
          description: '把阅读页做成浅灰工作区和绿色工具栏，更接近 WPS 文档浏览',
          category: '伪装皮肤',
          preview: {
            backgroundColor: '#eef2f4',
            textColor: '#1f5138',
            styleVars: {
              '--reader-top-bar-bg': 'linear-gradient(180deg, #1c9f6a 0%, #167b54 100%)',
              '--reader-body-surface': '#ffffff',
            },
          },
          resolve() {
            return {
              backgroundColor: '#eef2f4',
              backgroundImage:
                'radial-gradient(circle at 80% 6%, rgba(28, 159, 106, 0.16) 0, transparent 22%), linear-gradient(180deg, #f2f5f6 0%, #e6ecef 100%)',
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
              textColor: '#1f2937',
              selectionColor: '#bce8d4',
              styleVars: makeWindowVars({
                bodyTop: '80px',
                bodyRight: '108px',
                bodyBottom: '38px',
                bodyLeft: '108px',
                bodyMaxWidth: '980px',
                bodySurface: 'linear-gradient(180deg, #ffffff 0%, #fbfdfc 100%)',
                bodyBorder: '1px solid rgba(15, 23, 42, 0.08)',
                bodyShadow: '0 24px 64px rgba(15, 23, 42, 0.12)',
                bodyRadius: '18px',
                topTop: '18px',
                topInset: '80px',
                topMaxWidth: '1040px',
                topRadius: '18px 18px 0 0',
                topBorder: '1px solid rgba(10, 80, 50, 0.1)',
                topShadow: '0 14px 28px rgba(22, 88, 62, 0.14)',
                topBackground: 'linear-gradient(180deg, #1da56f 0%, #14724d 100%)',
                topColor: '#f1fff8',
                topLinkColor: '#d1fae5',
                bottomBottom: '18px',
                bottomInset: '88px',
                bottomMaxWidth: '1040px',
                bottomRadius: '14px',
                bottomBorder: '1px solid rgba(20, 114, 77, 0.08)',
                bottomShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
                bottomBackground: 'rgba(255, 255, 255, 0.92)',
                bottomColor: '#295846',
                bottomAccent: '#16a34a',
              }),
            };
          },
        },
      ],
      dispose: async function () {
        unlisten();
        await restoreAppTheme();
      },
    };
  },
});
