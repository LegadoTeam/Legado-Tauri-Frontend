// ==UserScript==
// @name         自定义背景
// @namespace    com.legado.extensions
// @version      1.0.0
// @description  注入一个可配置的自定义背景方案，支持程序化生成与复杂静态排版背景
// @author       designer_x
// @category     主题风格
// @match        *
// @grant        none
// @run-at       document-start
// @enabled      false
// ==/UserScript==

function svgDataUrl(svg) {
  return 'url("data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg) + '")';
}

function buildFrameSvg(baseColor, accentColor, secondaryColor) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 2400" preserveAspectRatio="none">' +
    '<defs>' +
    '<linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="' +
    accentColor +
    '" stop-opacity="0.92"/>' +
    '<stop offset="100%" stop-color="' +
    secondaryColor +
    '" stop-opacity="0.72"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<rect width="1600" height="2400" fill="' +
    baseColor +
    '"/>' +
    '<rect x="56" y="56" width="1488" height="2288" rx="42" fill="none" stroke="url(%23frame)" stroke-width="22"/>' +
    '<rect x="104" y="104" width="1392" height="2192" rx="36" fill="none" stroke="' +
    secondaryColor +
    '" stroke-width="6" stroke-opacity="0.48"/>' +
    '<path d="M80 260h180M1340 260h180M80 2140h180M1340 2140h180" stroke="' +
    accentColor +
    '" stroke-width="10" stroke-linecap="round" stroke-opacity="0.78"/>' +
    '<circle cx="140" cy="140" r="20" fill="' +
    accentColor +
    '" fill-opacity="0.35"/>' +
    '<circle cx="1460" cy="140" r="20" fill="' +
    accentColor +
    '" fill-opacity="0.35"/>' +
    '<circle cx="140" cy="2260" r="20" fill="' +
    accentColor +
    '" fill-opacity="0.35"/>' +
    '<circle cx="1460" cy="2260" r="20" fill="' +
    accentColor +
    '" fill-opacity="0.35"/>' +
    '</svg>'
  );
}

function clampPercent(value, fallback) {
  var next = Number(value);
  if (!isFinite(next)) {
    next = fallback;
  }
  return Math.max(0, Math.min(100, next));
}

function buildBackground(settings) {
  var baseColor = settings.baseColor ?? '#f5efe2';
  var accentColor = settings.accentColor ?? '#7aa2f7';
  var secondaryColor = settings.secondaryColor ?? '#d5b88f';
  var opacity = clampPercent(settings.opacity, 70) / 100;
  var scale = clampPercent(settings.scale, 100);
  var style = settings.style ?? 'mesh';

  if (style === 'frame') {
    return {
      backgroundColor: baseColor,
      backgroundImage:
        svgDataUrl(buildFrameSvg(baseColor, accentColor, secondaryColor)) +
        ', radial-gradient(circle at 12% 18%, rgba(255,255,255,' +
        opacity * 0.34 +
        ') 0, transparent 26%), radial-gradient(circle at 86% 78%, rgba(255,255,255,' +
        opacity * 0.18 +
        ') 0, transparent 24%)',
      backgroundSize: 'cover, cover, cover',
      backgroundPosition: 'center, center, center',
      backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
      backgroundBlendMode: 'normal, screen, screen',
    };
  }

  if (style === 'paper') {
    return {
      backgroundColor: baseColor,
      backgroundImage:
        'repeating-linear-gradient(0deg, rgba(121, 86, 43, ' +
        opacity * 0.12 +
        ') 0 1px, transparent 1px 30px), radial-gradient(circle at 20% 18%, rgba(255,255,255,' +
        opacity * 0.3 +
        ') 0, transparent 28%), radial-gradient(circle at 82% 74%, rgba(0,0,0,' +
        opacity * 0.08 +
        ') 0, transparent 22%)',
      backgroundSize: scale + '% auto, cover, cover',
      backgroundPosition: 'center top, center, center',
      backgroundRepeat: 'repeat, no-repeat, no-repeat',
      backgroundBlendMode: 'multiply, screen, multiply',
    };
  }

  if (style === 'window') {
    return {
      backgroundColor: baseColor,
      backgroundImage:
        'linear-gradient(135deg, rgba(255,255,255,' +
        opacity * 0.18 +
        ') 0%, transparent 45%), linear-gradient(225deg, rgba(255,255,255,' +
        opacity * 0.1 +
        ') 0%, transparent 40%), linear-gradient(90deg, rgba(0,0,0,' +
        opacity * 0.12 +
        ') 0 1px, transparent 1px), linear-gradient(0deg, rgba(0,0,0,' +
        opacity * 0.09 +
        ') 0 1px, transparent 1px)',
      backgroundSize: 'cover, cover, 56px 56px, 56px 56px',
      backgroundPosition: 'center, center, center, center',
      backgroundRepeat: 'no-repeat, no-repeat, repeat, repeat',
      backgroundBlendMode: 'screen, screen, multiply, multiply',
    };
  }

  return {
    backgroundColor: baseColor,
    backgroundImage:
      'radial-gradient(circle at 15% 20%, rgba(255,255,255,' +
      opacity * 0.28 +
      ') 0, transparent 24%), radial-gradient(circle at 80% 16%, rgba(255,255,255,' +
      opacity * 0.12 +
      ') 0, transparent 22%), linear-gradient(135deg, ' +
      accentColor +
      '22 0%, transparent 42%), linear-gradient(225deg, ' +
      secondaryColor +
      '22 0%, transparent 40%)',
    backgroundSize: 'cover, cover, cover, cover',
    backgroundPosition: 'center, center, center, center',
    backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
    backgroundBlendMode: 'screen, screen, multiply, multiply',
  };
}

legado.registerPlugin({
  id: 'reader-custom-backgrounds',
  setup: function () {
    return {
      settings: {
        defaults: {
          style: 'mesh',
          baseColor: '#f5efe2',
          accentColor: '#7aa2f7',
          secondaryColor: '#d5b88f',
          opacity: 70,
          scale: 100,
        },
        schema: function () {
          return [
            {
              type: 'select',
              key: 'style',
              label: '背景风格',
              options: [
                { label: '流光叠层', value: 'mesh' },
                { label: '装饰边框', value: 'frame' },
                { label: '纸纹页', value: 'paper' },
                { label: '窗格布局', value: 'window' },
              ],
            },
            { type: 'color', key: 'baseColor', label: '底色' },
            { type: 'color', key: 'accentColor', label: '主强调色' },
            { type: 'color', key: 'secondaryColor', label: '辅强调色' },
            { type: 'slider', key: 'opacity', label: '纹理强度', min: 0, max: 100, step: 5 },
            { type: 'slider', key: 'scale', label: '图层缩放', min: 60, max: 160, step: 5 },
          ];
        },
      },
      backgrounds: [
        {
          id: 'custom-background',
          name: '自定义背景',
          description: '由插件设置决定的自定义背景，可在程序化纹理和静态排版图之间切换',
          preview: function (_, api) {
            return buildBackground(api.settings.getAll());
          },
          resolve: function (_, api) {
            return buildBackground(api.settings.getAll());
          },
        },
      ],
    };
  },
});
