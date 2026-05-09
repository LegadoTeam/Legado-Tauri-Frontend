// ==UserScript==
// @name         正文广告过滤器
// @namespace    com.legado.extensions
// @version      1.1.0
// @description  在分页前和渲染前清理常见广告、水印和附加规则
// @author       Legado 社区
// @category     内容处理
// @match        *
// @grant        none
// @run-at       content-ready
// @enabled      true
// ==/UserScript==

var BUILTIN_RULES = [
  '请记住本书首发域名',
  '天才一秒记住',
  '最新网址',
  '手机用户请浏览',
  /本章未完[，,]点击下一页继续阅读/,
  /\(本章完\)/,
  /(?:笔趣阁|顶点小说|笔趣看).*/,
];

function getRules(api) {
  var extraRules = api.settings.get('extraRules', []);
  var rules = api.settings.get('enableBuiltins', true) ? BUILTIN_RULES.slice() : [];
  for (var i = 0; i < extraRules.length; i += 1) {
    if (extraRules[i]) {
      rules.push(extraRules[i]);
    }
  }
  return rules;
}

function cleanup(content, api) {
  var lines = String(content || '').split('\n');
  var rules = getRules(api);
  var filtered = lines
    .filter(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return true;
      for (var i = 0; i < rules.length; i += 1) {
        var rule = rules[i];
        if (typeof rule === 'string' && trimmed.indexOf(rule) >= 0) {
          return false;
        }
        if (rule && typeof rule.test === 'function' && rule.test(trimmed)) {
          return false;
        }
      }
      return true;
    })
    .join('\n');

  if (api.settings.get('collapseBlankLines', true)) {
    filtered = filtered.replace(/\n{3,}/g, '\n\n');
  }
  return filtered.trim();
}

legado.registerPlugin({
  id: 'reader-ad-cleaner',
  setup: function (api) {
    return {
      settings: {
        defaults: {
          enableBuiltins: true,
          extraRules: [],
          collapseBlankLines: true,
        },
        schema: function (context) {
          var count = (context.values.extraRules || []).filter(Boolean).length;
          return [
            {
              type: 'info',
              label: '正文过滤在分页前执行',
              description: '可叠加内置规则和自定义规则，修改后阅读页会自动重新处理当前章节。',
            },
            {
              type: 'switch',
              key: 'enableBuiltins',
              label: '启用内置规则',
              description: '关闭后只保留你自己填写的过滤规则',
            },
            {
              type: 'string-list',
              key: 'extraRules',
              label: '附加规则（' + count + ' 条）',
              description: '按行填写要过滤的文本片段，命中后整行移除',
            },
            {
              type: 'switch',
              key: 'collapseBlankLines',
              label: '合并连续空行',
            },
          ];
        },
      },
      hooks: {
        'reader.content.beforePaginate': function (payload, hookApi) {
          return cleanup(payload.content, hookApi);
        },
      },
    };
  },
});
