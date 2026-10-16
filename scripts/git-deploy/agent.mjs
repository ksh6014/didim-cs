import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { sha, textSha, exists, writeJson, safeFile, assertPolicy, isInput, fingerprints, assertUnchanged, checkHttp, applyRelease, recover } from './core.mjs'
const execute = promisify(execFile)
const initialCommit = '29bc25c4074551ac4f7e4cea46f28e426994d62b'
const initialAssets = {
  'dist/assets/index-BFThlYWn.js': 'efd4b1f82a7144e8c6f7036871e839444b935498c5ec1b7a61ab5b82d547c3a7',
  'dist/assets/index-Db8JonSq.css': '460e57f47017e47c039ea3bb0142ffd44ae22a818eb8a0333ba9aadb6ee93b70',
}
const protectedFiles = ['server/index.ts', 'server/worklog-entries.mjs', 'prisma/schema.prisma', 'prisma.config.ts', 'package-lock.json']
async function command(executable, args, cwd, timeout = 600000) {
  try {
    const childEnvironment = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }
    // A deployment test can launch the real pipeline; do not let Node silently skip its child tests.
    delete childEnvironment.NODE_TEST_CONTEXT
    return await execute(executable, args, { cwd, timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
      env: childEnvironment })
  } catch (error) { throw new Error(`${path.basename(executable)} failed: ${(error.stderr || error.stdout || error.message).slice(-3000)}`) }
}
const git = async (config, ...args) => (await command(config.gitPath, ['-C', config.sourceRoot, ...args], config.sourceRoot, 120000)).stdout.trim()
const blob = async (config, revision, name) => (await command(config.gitPath, ['-C', config.sourceRoot, 'show', `${revision}:${name}`], config.sourceRoot)).stdout
async function tree(config, revision) {
  const raw = await git(config, 'ls-tree', '-r', '-z', revision)
  const files = raw.split('\0').filter(Boolean).map(row => {
    const [metadata, name] = row.split('\t')
    if (!/^(100644|100755) blob /.test(metadata)) throw new Error(`Symlink/submodule is not deployable: ${name}`)
    return name
  })
  return files
}
function originName(value) { return value.replace(/\.git$/, '').replace(/\/$/, '') }
async function checkConfig(config) {
  for (const key of ['sourceRoot', 'runtimeRoot', 'controlRoot', 'buildRoot', 'gitPath', 'npmCli', 'tarPath']) if (!path.isAbsolute(config[key])) throw new Error(`Absolute path required: ${key}`)
  if (path.resolve(config.sourceRoot) === path.resolve(config.runtimeRoot)) throw new Error('Source and runtime folders must differ')
  if (path.resolve(config.controlRoot) !== path.join(path.resolve(config.runtimeRoot), 'deployment', 'git-auto')) throw new Error('Unexpected control folder')
  if (path.resolve(config.buildRoot) !== path.join(path.resolve(config.sourceRoot), 'deployment', 'git-releases')) throw new Error('Unexpected build folder')
  const health = new URL(config.healthUrl)
  if (health.protocol !== 'http:' || health.hostname !== '127.0.0.1' || health.pathname !== '/') throw new Error('Health URL must be the loopback root')
  if (config.pollSeconds < 30 || config.pollSeconds > 3600) throw new Error('Poll interval must be 30..3600 seconds')
  for (const root of [config.sourceRoot, config.runtimeRoot, config.controlRoot]) {
    if ((await fs.lstat(root)).isSymbolicLink()) throw new Error('Project/control junctions are not supported')
  }
  await safeFile(config.sourceRoot, 'deployment/git-releases')
  if (originName(await git(config, 'remote', 'get-url', 'origin')) !== 'https://github.com/ksh6014/didim-cs') throw new Error('Wrong origin repository')
}
async function assertProtected(config) {
  for (const name of protectedFiles) {
    if (textSha(await fs.readFile(await safeFile(config.runtimeRoot, name))) !== textSha(await blob(config, initialCommit, name))) throw new Error(`Runtime backend/package differs from approved baseline: ${name}`)
  }
  const expected = JSON.parse(await blob(config, initialCommit, 'package.json'))
  const actual = JSON.parse(await fs.readFile(path.join(config.runtimeRoot, 'package.json'), 'utf8'))
  delete actual.allowScripts
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Runtime package.json differs beyond the preserved allowScripts setting')
}
async function lock(config) {
  const file = await safeFile(config.runtimeRoot, 'deployment/deployment.lock')
  try { return { file, handle: await fs.open(file, 'wx') } }
  catch (error) { if (error.code === 'EEXIST') return null; throw error }
}
async function unlock(held) { if (held) { await held.handle.close(); await fs.unlink(held.file) } }
async function log(config, message) {
  const line = `${new Date().toISOString()} ${message}`
  console.log(line)
  await fs.appendFile(path.join(config.controlRoot, 'agent.log'), `${line}\n`)
}
export async function initialize(config) {
  await checkConfig(config)
  const held = await lock(config)
  if (!held) throw new Error('Another deployment lock exists. Do not remove it blindly.')
  try {
    const stateFile = path.join(config.controlRoot, 'state.json')
    if (await exists(stateFile)) throw new Error('Already initialized; existing deployment state was preserved')
    await assertProtected(config)
    const files = (await tree(config, initialCommit)).filter(isInput)
    assertPolicy(files)
    for (const name of files) {
      const actual = await fs.readFile(await safeFile(config.runtimeRoot, name))
      // Compare Git blobs as binary for images and normalize only text extensions.
      const expected = (await command(config.gitPath, ['-C', config.sourceRoot, 'show', `${initialCommit}:${name}`], config.sourceRoot)).stdout
      if (/\.(png|jpg|jpeg|gif|webp|ico)$/i.test(name)) {
        const binary = await execute(config.gitPath, ['-C', config.sourceRoot, 'show', `${initialCommit}:${name}`], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, windowsHide: true })
        if (sha(actual) !== sha(binary.stdout)) throw new Error(`Runtime input differs: ${name}`)
      } else if (textSha(actual) !== textSha(expected)) throw new Error(`Runtime input differs: ${name}`)
    }
    const outputFiles = ['dist/index.html', ...Object.keys(initialAssets), ...files.filter(name => name.startsWith('public/')).map(name => `dist/${name.slice(7)}`)]
    const runtimeFiles = await fingerprints(config.runtimeRoot, [...files, ...outputFiles])
    for (const [name, hash] of Object.entries(initialAssets)) if (runtimeFiles[name] !== hash) throw new Error(`Initial runtime build differs: ${name}`)
    const html = await fs.readFile(path.join(config.runtimeRoot, 'dist/index.html'), 'utf8')
    if (!['98bae7fed1c6fedbf0a1bacbdea26c0ae0d97d44dc3b4eac8040fe9acabc8155', '40fad340c51804608457bdaa93ea100798b3a44e24ae89df7c1c0684fb4b3ee4'].includes(textSha(html))) throw new Error('Initial runtime HTML differs')
    for (const name of files.filter(name => name.startsWith('public/'))) {
      if (sha(await fs.readFile(await safeFile(config.runtimeRoot, name))) !== runtimeFiles[`dist/${name.slice(7)}`]) throw new Error(`Public build differs: ${name}`)
    }
    await checkHttp(config.healthUrl, Object.fromEntries(outputFiles.map(name => [name, runtimeFiles[name]])))
    await writeJson(stateFile, { acceptedCommit: initialCommit, frontendCommit: initialCommit, runtimeFiles, failedCommit: null, initializedAt: new Date().toISOString() })
    await log(config, `INITIALIZED ${initialCommit}; no runtime files changed`)
  } finally { await unlock(held) }
}
async function stageBuild(config, target) {
  const root = path.join(config.buildRoot, `${Date.now()}-${target.slice(0, 12)}`)
  await fs.mkdir(root, { recursive: true })
  const archive = path.join(root, 'source.zip')
  const source = path.join(root, 'source')
  await git(config, 'archive', '--format=zip', `--output=${archive}`, target)
  await fs.mkdir(source)
  await command(config.tarPath, ['-xf', archive, '-C', source], root)
  async function step(name, args) {
    try {
      const result = await command(process.execPath, args, source)
      await fs.writeFile(path.join(root, `${name}.log`), result.stdout + result.stderr)
      return result
    } catch (error) { await fs.writeFile(path.join(root, `${name}.log`), error.message); throw error }
  }
  await step('install', [config.npmCli, 'ci', '--ignore-scripts', '--include=dev', '--no-audit', '--no-fund'])
  const tests = await step('test', ['--test', '--test-reporter=tap', 'src/LeaveCalendarDays.test.mjs', 'server/worklog-entries.test.mjs'])
  const passCount = Number(tests.stdout.match(/# pass (\d+)/)?.[1] || 0)
  if (passCount < 14 || !/# fail 0\b/.test(tests.stdout)) throw new Error('Baseline tests did not actually execute/pass; inspect test.log')
  await step('build', [config.npmCli, 'run', 'build'])
  return source
}
async function fetchTarget(config) {
  await git(config, 'fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main')
  return git(config, 'rev-parse', 'refs/remotes/origin/main')
}
export async function runOnce(config, { retry = false, getTarget = fetchTarget, buildRelease = stageBuild } = {}) {
  await checkConfig(config)
  if (await exists(path.join(config.controlRoot, 'PAUSED'))) return 'paused'
  const held = await lock(config)
  if (!held) return 'busy'
  let target
  let state
  try {
    if (await recover(config)) {
      await fs.writeFile(path.join(config.controlRoot, 'PAUSED'), 'Interrupted deployment recovered. Review before resuming.\n')
      await log(config, 'RECOVERED interrupted deployment; PAUSED for review')
      return 'recovered'
    }
    const stateFile = path.join(config.controlRoot, 'state.json')
    state = JSON.parse(await fs.readFile(stateFile, 'utf8'))
    await assertProtected(config)
    await assertUnchanged(config.runtimeRoot, state.runtimeFiles)
    target = await getTarget(config)
    if (target === state.acceptedCommit) return 'unchanged'
    if (!retry && target === state.failedCommit) return 'previously-failed'
    await git(config, 'merge-base', '--is-ancestor', state.acceptedCommit, target)
    const changed = (await git(config, 'diff', '--no-renames', '--name-only', '-z', state.acceptedCommit, target)).split('\0').filter(Boolean)
    // Compare all changes to the fixed approved backend/dependency baseline too.
    const allChanges = (await git(config, 'diff', '--no-renames', '--name-only', '-z', initialCommit, target)).split('\0').filter(Boolean)
    assertPolicy(allChanges)
    const treeFiles = await tree(config, target)
    for (const name of treeFiles) if (/^(\.env(?:\.|$)|\.deploy-token$)|\.(db|sqlite|sqlite3|jks|keystore)$/i.test(name)) throw new Error(`Forbidden tracked file: ${name}`)
    if (!changed.some(isInput)) {
      await writeJson(stateFile, { ...state, acceptedCommit: target, failedCommit: null })
      await log(config, `ACCEPTED ${target}; no frontend change, no build or runtime replacement`)
      return 'tooling-only'
    }
    await log(config, `BUILDING ${target}`)
    const release = await buildRelease(config, target)
    await assertProtected(config)
    if (await exists(path.join(config.controlRoot, 'PAUSED'))) return 'paused'
    await applyRelease(config, state, release, target)
    await log(config, `APPLIED ${target}; HTTP content verified, no restart`)
    return 'applied'
  } catch (error) {
    if (state && target) {
      // Reload state after rollback; never retain a partially applied state in this catch path.
      const stateFile = path.join(config.controlRoot, 'state.json')
      const restored = JSON.parse(await fs.readFile(stateFile, 'utf8'))
      await writeJson(stateFile, { ...restored, failedCommit: target, lastError: error.message, failedAt: new Date().toISOString() })
    }
    throw error
  } finally { await unlock(held) }
}
async function main() {
  const args = process.argv.slice(2)
  const configIndex = args.indexOf('--config')
  if (configIndex < 0 || !args[configIndex + 1]) throw new Error('--config path is required')
  const config = JSON.parse((await fs.readFile(args[configIndex + 1], 'utf8')).replace(/^\uFEFF/, ''))
  if (args.includes('--initialize')) return initialize(config)
  if (args.includes('--once')) { console.log(await runOnce(config, { retry: args.includes('--retry') })); return }
  let previousError = ''
  for (;;) {
    try { await runOnce(config); previousError = '' }
    catch (error) { if (error.message !== previousError) await log(config, `FAILED ${error.message}`); previousError = error.message }
    await new Promise(resolve => setTimeout(resolve, config.pollSeconds * 1000))
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
