import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT, 'dist');
const TARGET_DIR = path.join(ROOT, 'LegadoArkTS/entry/src/main/resources/rawfile/web');

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirContents(sourceDir, targetDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    await cp(source, target, { recursive: true, force: true });
  }
}

async function inlineHarmonyHtml(targetDir) {
  const indexPath = path.join(targetDir, 'index.html');
  let html = await readFile(indexPath, 'utf8');

  html = html.replace(
    /<link rel="modulepreload"[^>]*href="\.\/assets\/[^"]+"[^>]*>\s*/g,
    ''
  );

  html = await replaceAsync(
    html,
    /<link rel="stylesheet"[^>]*href="(\.\/assets\/[^"]+\.css)"[^>]*>/g,
    async (_full, href) => {
      const cssPath = path.join(targetDir, href.replace(/^\.\//, ''));
      const css = await readFile(cssPath, 'utf8');
      return `<style>\n${css}\n</style>`;
    }
  );

  html = await replaceAsync(
    html,
    /<script type="module"[^>]*src="(\.\/assets\/[^"]+\.js)"[^>]*><\/script>/g,
    async (_full, src) => {
      const jsPath = path.join(targetDir, src.replace(/^\.\//, ''));
      const js = await readFile(jsPath, 'utf8');
      return `<script type="module">\n${js}\n</script>`;
    }
  );

  await writeFile(indexPath, html, 'utf8');
}

async function replaceAsync(input, pattern, replacer) {
  const matches = [...input.matchAll(pattern)];
  if (matches.length === 0) return input;

  let output = '';
  let lastIndex = 0;
  for (const match of matches) {
    const index = match.index ?? 0;
    output += input.slice(lastIndex, index);
    output += await replacer(...match);
    lastIndex = index + match[0].length;
  }
  output += input.slice(lastIndex);
  return output;
}

async function main() {
  if (!(await exists(path.join(DIST_DIR, 'index.html')))) {
    throw new Error(`未找到构建产物：${path.join(DIST_DIR, 'index.html')}`);
  }

  await rm(TARGET_DIR, { recursive: true, force: true });
  await mkdir(TARGET_DIR, { recursive: true });
  await copyDirContents(DIST_DIR, TARGET_DIR);
  await inlineHarmonyHtml(TARGET_DIR);

  const targetIndex = path.join(TARGET_DIR, 'index.html');
  if (!(await exists(targetIndex))) {
    throw new Error(`同步失败：缺少 ${targetIndex}`);
  }

  console.log(`[copy-harmony-web] 已同步并内联 dist -> ${TARGET_DIR}`);
}

main().catch((error) => {
  console.error(`[copy-harmony-web] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
