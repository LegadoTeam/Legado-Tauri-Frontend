import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReleaseVersion } from './release-version.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, '构建结果')
const RELEASE_VERSION = createReleaseVersion()

const platform = process.argv[2]

function usage() {
  console.error('用法: node scripts/copy-build-result.mjs <android|windows>')
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function listFiles(dir, predicate) {
  if (!(await exists(dir))) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(full, predicate))
    } else if (entry.isFile() && predicate(full)) {
      files.push(full)
    }
  }
  return files
}

async function listDirectFiles(dir, predicate) {
  if (!(await exists(dir))) return []
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dir, entry.name))
    .filter(predicate)
}

async function newestFirst(files) {
  const withTime = await Promise.all(files.map(async (file) => ({
    file,
    mtimeMs: (await stat(file)).mtimeMs,
  })))
  return withTime.sort((a, b) => b.mtimeMs - a.mtimeMs).map((item) => item.file)
}

async function androidArtifacts() {
  const apkDirs = [
    path.join(ROOT, 'src-tauri/gen/android/app/build/outputs/apk/universal/release'),
    path.join(ROOT, 'src-tauri/gen/android/app/build/outputs/apk'),
  ]
  const files = []
  for (const dir of apkDirs) {
    files.push(...await listFiles(dir, (file) => (
      file.toLowerCase().endsWith('.apk')
      && file.toLowerCase().includes('release')
    )))
  }
  return [...new Set(await newestFirst(files))]
}

async function windowsArtifacts() {
  // const bundleDirs = [
  //   path.join(ROOT, 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis'),
  //   path.join(ROOT, 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi'),
  //   path.join(ROOT, 'src-tauri/target/release/bundle/nsis'),
  //   path.join(ROOT, 'src-tauri/target/release/bundle/msi'),
  // ];
  // const isInstaller = (file) => {
  //   const lower = file.toLowerCase();
  //   return lower.endsWith('.exe') || lower.endsWith('.msi');
  // };
  // const bundled = [];
  // for (const dir of bundleDirs) {
  //   bundled.push(...await listFiles(dir, isInstaller));
  // }

  const runnableCandidates = [
    path.join(ROOT, 'src-tauri/target/x86_64-pc-windows-msvc/release/legado_tauri.exe'),
    path.join(ROOT, 'src-tauri/target/x86_64-pc-windows-msvc/release/legado_tauri.pdb'),
  ]
  const runnable = []
  for (const file of runnableCandidates) {
    if (await exists(file)) {
      runnable.push(file)
    }
  }

  if (runnable.length) {
    return [...new Set(await newestFirst(runnable))]
  }

  const fallbackDirs = [
    path.join(ROOT, 'src-tauri/target/x86_64-pc-windows-msvc/release'),
    path.join(ROOT, 'src-tauri/target/release'),
  ]
  const fallback = []
  for (const dir of fallbackDirs) {
    fallback.push(...await listDirectFiles(dir, (file) => {
      const lower = file.toLowerCase()
      return lower.endsWith('.exe') || lower.endsWith('.pdb')
    }))
  }
  return [...new Set(await newestFirst(fallback))]
}

async function copyArtifacts(kind, files) {
  if (!files.length) {
    throw new Error(`未找到 ${kind} 构建产物`)
  }
  await mkdir(OUT_DIR, { recursive: true })
  const copied = []
  for (const source of files) {
    const parsed = path.parse(source)
    let dest = path.join(
      OUT_DIR,
      `${parsed.name}-${RELEASE_VERSION.artifactVersion}-${kind}${parsed.ext}`,
    )
    for (let index = 2; await exists(dest); index += 1) {
      dest = path.join(
        OUT_DIR,
        `${parsed.name}-${RELEASE_VERSION.artifactVersion}-${kind}-${index}${parsed.ext}`,
      )
    }
    await copyFile(source, dest)
    copied.push(dest)
  }
  return copied
}

if (!['android', 'windows'].includes(platform)) {
  usage()
  process.exit(1)
}

try {
  const artifacts = platform === 'android'
    ? await androidArtifacts()
    : await windowsArtifacts()
  const copied = await copyArtifacts(platform, artifacts)
  console.log(`[copy-build-result] 已复制 ${copied.length} 个构建产物到 ${OUT_DIR}`)
  console.log(`[copy-build-result] 统一构建版本: ${RELEASE_VERSION.releaseVersion}`)
  for (const file of copied) {
    console.log(`  - ${file}`)
  }
} catch (error) {
  console.error(`[copy-build-result] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
