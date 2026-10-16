import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertPolicy, sha, exists, safeFile, writeJson, applyRelease, recover } from './core.mjs'
import { initialize, runOnce } from './agent.mjs'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const gitPath = execFileSync('where.exe', ['git.exe'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
const base = '29bc25c4074551ac4f7e4cea46f28e426994d62b'
const tracked = execFileSync(gitPath, ['-C', project, 'ls-tree', '-r', '--name-only', base], { encoding: 'utf8' }).trim().split(/\r?\n/)
const inputs = tracked.filter(name => name.startsWith('src/') || name.startsWith('public/') || ['index.html', 'vite.config.js'].includes(name))
const protectedFiles = ['server/index.ts', 'server/worklog-entries.mjs', 'prisma/schema.prisma', 'prisma.config.ts', 'package.json', 'package-lock.json']
const root = await fs.mkdtemp(path.join(project, 'deployment', 'git-auto-test-'))
async function put(folder, name, content) {
  await fs.mkdir(path.dirname(path.join(folder, name)), { recursive: true })
  await fs.writeFile(path.join(folder, name), content)
}
async function fixture() {
  const folder = await fs.mkdtemp(path.join(root, 'case-'))
  const runtimeRoot = path.join(folder, 'runtime')
  const controlRoot = path.join(runtimeRoot, 'deployment', 'git-auto')
  await fs.mkdir(controlRoot, { recursive: true })
  for (const name of [...inputs, ...protectedFiles]) {
    const bytes = name.startsWith('src/') || name.startsWith('public/') || ['index.html', 'vite.config.js'].includes(name)
      ? await fs.readFile(path.join(project, name))
      : execFileSync(gitPath, ['-C', project, 'show', `${base}:${name}`])
    await put(runtimeRoot, name, bytes)
  }
  const packageFile = path.join(runtimeRoot, 'package.json')
  const json = JSON.parse(await fs.readFile(packageFile, 'utf8'))
  json.allowScripts = { 'better-sqlite3@12.11.1': true }
  await fs.writeFile(packageFile, JSON.stringify(json))
  for (const name of ['index.html', 'assets/index-BFThlYWn.js', 'assets/index-Db8JonSq.css', ...inputs.filter(name => name.startsWith('public/')).map(name => name.slice(7))]) {
    await put(runtimeRoot, `dist/${name}`, await fs.readFile(path.join(project, 'dist', name)))
  }
  const sentinels = ['.env', '.deploy-token', 'prisma/dev.db', 'uploads/customer.txt', 'dist/downloads/keep.apk']
  for (const name of sentinels) await put(runtimeRoot, name, `must remain: ${name}`)
  let failAssets = false
  const server = http.createServer(async (req, res) => {
    try {
      if (failAssets && req.url.startsWith('/assets/test-new')) throw new Error('simulated asset failure')
      const name = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.slice(1))
      const file = path.resolve(runtimeRoot, 'dist', name)
      if (!file.startsWith(path.join(runtimeRoot, 'dist') + path.sep)) throw new Error('outside root')
      res.end(await fs.readFile(file))
    } catch { res.writeHead(404); res.end('fixture 404') }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const config = { sourceRoot: project, runtimeRoot, controlRoot, buildRoot: path.join(project, 'deployment/git-releases'), gitPath, npmCli: 'C:\\fixture\\npm-cli.js', tarPath: 'C:\\fixture\\tar.exe', pollSeconds: 60, healthUrl: `http://127.0.0.1:${server.address().port}/` }
  async function close() { await new Promise(resolve => server.close(resolve)) }
  async function unchanged() {
    for (const name of sentinels) assert.equal(await fs.readFile(path.join(runtimeRoot, name), 'utf8'), `must remain: ${name}`)
    assert.deepEqual(JSON.parse(await fs.readFile(packageFile, 'utf8')).allowScripts, { 'better-sqlite3@12.11.1': true })
  }
  async function state() { return JSON.parse(await fs.readFile(path.join(controlRoot, 'state.json'), 'utf8')) }
  return { folder, config, close, unchanged, state, fail: () => { failAssets = true } }
}
async function release(f) {
  const dir = path.join(f.folder, 'release')
  for (const name of inputs) await put(dir, name, await fs.readFile(path.join(project, name)))
  const html = '<html><script src="/assets/test-new.js"></script><link href="/assets/test-new.css" rel="stylesheet"></html>'
  await put(dir, 'dist/index.html', html)
  await put(dir, 'dist/assets/test-new.js', 'console.log("new release")')
  await put(dir, 'dist/assets/test-new.css', 'body { color: black }')
  for (const name of inputs.filter(name => name.startsWith('public/'))) await put(dir, `dist/${name.slice(7)}`, await fs.readFile(path.join(dir, name)))
  await fs.appendFile(path.join(dir, 'src/App.jsx'), '\n// integration fixture update\n')
  return dir
}

await test('policy accepts frontend/tooling and blocks backend, dependencies and data', () => {
  assert.doesNotThrow(() => assertPolicy(['src/App.jsx', 'public/icons.svg', 'index.html', 'scripts/git-deploy/agent.mjs', 'docs/GIT-AUTO-DEPLOY.md']))
  for (const name of ['server/index.ts', 'prisma/schema.prisma', 'package.json', 'package-lock.json', 'scripts/apply-deployment.ps1', 'public/downloads/secret.apk', 'src/.env', 'src/private.db', '../outside', 'src\\App.jsx', '/absolute']) assert.throws(() => assertPolicy([name]), name)
})
await test('initialization verifies approved baseline and preserves business data and package allowance', async () => {
  const f = await fixture()
  try {
    const before = await fs.readFile(path.join(f.config.runtimeRoot, 'dist/index.html'))
    await initialize(f.config)
    assert.equal((await f.state()).frontendCommit, base)
    assert.deepEqual(await fs.readFile(path.join(f.config.runtimeRoot, 'dist/index.html')), before)
    await f.unchanged()
    await assert.rejects(initialize(f.config), /Already initialized/)
  } finally { await f.close() }
})
await test('frontend deployment updates files, records backup, verifies HTTP and retains old assets/downloads', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const source = await release(f)
    const state = await applyRelease(f.config, await f.state(), source, 'a'.repeat(40))
    assert.equal(state.frontendCommit, 'a'.repeat(40))
    assert.ok(await exists(path.join(state.lastBackup, 'applied-journal.json')))
    assert.ok(await exists(path.join(f.config.runtimeRoot, 'dist/assets/index-BFThlYWn.js')))
    assert.deepEqual(await fs.readFile(path.join(f.config.runtimeRoot, 'src/App.jsx')), await fs.readFile(path.join(source, 'src/App.jsx')))
    await f.unchanged()
  } finally { await f.close() }
})
await test('post-deploy HTTP error restores index, source and state', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const before = await f.state()
    const index = await fs.readFile(path.join(f.config.runtimeRoot, 'dist/index.html'))
    const app = await fs.readFile(path.join(f.config.runtimeRoot, 'src/App.jsx'))
    f.fail()
    await assert.rejects(applyRelease(f.config, before, await release(f), 'b'.repeat(40)), /previous files restored/)
    assert.deepEqual(await fs.readFile(path.join(f.config.runtimeRoot, 'dist/index.html')), index)
    assert.deepEqual(await fs.readFile(path.join(f.config.runtimeRoot, 'src/App.jsx')), app)
    assert.deepEqual(await f.state(), before)
    assert.equal(await exists(path.join(f.config.controlRoot, 'pending.json')), false)
    await f.unchanged()
  } finally { await f.close() }
})
await test('runtime drift prevents mutation', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    await fs.writeFile(path.join(f.config.runtimeRoot, 'src/App.jsx'), 'outside modification')
    await assert.rejects(applyRelease(f.config, await f.state(), await release(f), 'c'.repeat(40)), /Runtime changed/)
    assert.equal(await fs.readFile(path.join(f.config.runtimeRoot, 'src/App.jsx'), 'utf8'), 'outside modification')
    await f.unchanged()
  } finally { await f.close() }
})
await test('unmanaged collision is blocked before writing any live files', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const source = await release(f)
    await put(f.config.runtimeRoot, 'dist/assets/test-new.js', 'different existing file')
    await assert.rejects(applyRelease(f.config, await f.state(), source, 'd'.repeat(40)), /Unmanaged file collision/)
    assert.equal(await fs.readFile(path.join(f.config.runtimeRoot, 'dist/assets/test-new.js'), 'utf8'), 'different existing file')
  } finally { await f.close() }
})
await test('pending journal restores interrupted deployment and prior state', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const state = await f.state()
    const index = path.join(f.config.runtimeRoot, 'dist/index.html')
    const original = await fs.readFile(index)
    const backupRoot = path.join(f.config.controlRoot, 'backups/interrupted')
    await put(backupRoot, 'dist/index.html', original)
    await writeJson(path.join(f.config.controlRoot, 'pending.json'), { backupRoot, before: { 'dist/index.html': sha(original) }, previousState: state })
    await fs.writeFile(index, 'partially written release')
    assert.equal(await recover(f.config), true)
    assert.deepEqual(await fs.readFile(index), original)
    assert.equal(await exists(path.join(backupRoot, 'recovered-journal.json')), true)
    await f.unchanged()
  } finally { await f.close() }
})
await test('PAUSED and existing deployment lock skip without modifying another lock', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const paused = path.join(f.config.controlRoot, 'PAUSED')
    await fs.writeFile(paused, '')
    assert.equal(await runOnce(f.config), 'paused')
    await fs.unlink(paused)
    const lock = path.join(f.config.runtimeRoot, 'deployment/deployment.lock')
    await fs.writeFile(lock, 'other deployment')
    assert.equal(await runOnce(f.config), 'busy')
    assert.equal(await fs.readFile(lock, 'utf8'), 'other deployment')
  } finally { await f.close() }
})
await test('junction in a destination path is rejected', async () => {
  const f = await fixture()
  try {
    const outside = path.join(f.folder, 'outside')
    await fs.mkdir(outside)
    await fs.symlink(outside, path.join(f.config.runtimeRoot, 'escape'), 'junction')
    await assert.rejects(safeFile(f.config.runtimeRoot, 'escape/file.txt'), /Junction\/symlink/)
    assert.equal(await exists(path.join(outside, 'file.txt')), false)
  } finally { await f.close() }
})
async function commitFixture(f, name, suffix) {
  const repo = path.join(f.folder, 'git-source')
  execFileSync(gitPath, ['clone', '--no-hardlinks', '--quiet', project, repo])
  execFileSync(gitPath, ['-C', repo, 'remote', 'set-url', 'origin', 'https://github.com/ksh6014/didim-cs.git'])
  execFileSync(gitPath, ['-C', repo, 'config', 'user.name', 'Deployment Test'])
  execFileSync(gitPath, ['-C', repo, 'config', 'user.email', 'deployment-test@example.invalid'])
  await fs.appendFile(path.join(repo, name), suffix)
  execFileSync(gitPath, ['-C', repo, 'add', '--', name])
  execFileSync(gitPath, ['-C', repo, 'commit', '--quiet', '-m', 'integration fixture'])
  f.config.sourceRoot = repo
  f.config.buildRoot = path.join(repo, 'deployment/git-releases')
  return execFileSync(gitPath, ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}
await test('tooling-only commit records acceptance without build or runtime changes', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const target = await commitFixture(f, 'README.md', '\nfixture documentation update\n')
    const result = await runOnce(f.config, { getTarget: async () => target, buildRelease: () => { throw new Error('must not build') } })
    assert.equal(result, 'tooling-only')
    assert.equal((await f.state()).acceptedCommit, target)
    assert.equal((await f.state()).frontendCommit, base)
    await f.unchanged()
  } finally { await f.close() }
})
await test('build failure keeps runtime, suppresses repeated attempts, explicit retry can deploy', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const target = await commitFixture(f, 'src/App.jsx', '\n// fixture frontend update\n')
    let attempts = 0
    const options = { getTarget: async () => target, buildRelease: () => { attempts++; throw new Error('simulated build failure') } }
    const before = await fs.readFile(path.join(f.config.runtimeRoot, 'dist/index.html'))
    await assert.rejects(runOnce(f.config, options), /simulated build failure/)
    assert.equal((await f.state()).failedCommit, target)
    assert.deepEqual(await fs.readFile(path.join(f.config.runtimeRoot, 'dist/index.html')), before)
    assert.equal(await runOnce(f.config, options), 'previously-failed')
    assert.equal(attempts, 1)
    assert.equal(await runOnce(f.config, { getTarget: async () => target, buildRelease: () => release(f), retry: true }), 'applied')
    assert.equal((await f.state()).frontendCommit, target)
    await f.unchanged()
  } finally { await f.close() }
})
await test('backend commit is blocked before build', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const target = await commitFixture(f, 'server/index.ts', '\n// requires explicit backend deployment\n')
    let built = false
    await assert.rejects(runOnce(f.config, { getTarget: async () => target, buildRelease: () => { built = true } }), /Requires manual deployment/)
    assert.equal(built, false)
    assert.equal((await f.state()).frontendCommit, base)
    await f.unchanged()
  } finally { await f.close() }
})
await test('real Git archive, isolated npm install, tests, build and HTTP-verified deployment', { timeout: 180000 }, async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    const target = await commitFixture(f, 'src/App.jsx', '\n// real isolated build fixture\n')
    const npmCmd = execFileSync('where.exe', ['npm.cmd'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
    f.config.npmCli = path.join(path.dirname(npmCmd), 'node_modules/npm/bin/npm-cli.js')
    f.config.tarPath = execFileSync('where.exe', ['tar.exe'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
    assert.equal(await runOnce(f.config, { getTarget: async () => target }), 'applied')
    const state = await f.state()
    assert.equal(state.frontendCommit, target)
    const releases = await fs.readdir(f.config.buildRoot)
    const buildLog = await fs.readFile(path.join(f.config.buildRoot, releases[0], 'build.log'), 'utf8')
    const testLog = await fs.readFile(path.join(f.config.buildRoot, releases[0], 'test.log'), 'utf8')
    assert.match(buildLog, /built in/)
    assert.match(testLog, /pass 14/)
    await f.unchanged()
  } finally { await f.close() }
})
await test('renaming backend code into src still blocks automatic deployment', async () => {
  const f = await fixture()
  try {
    await initialize(f.config)
    await commitFixture(f, 'README.md', '\nrename fixture\n')
    const repo = f.config.sourceRoot
    execFileSync(gitPath, ['-C', repo, 'mv', 'server/index.ts', 'src/renamed-server.ts'])
    execFileSync(gitPath, ['-C', repo, 'commit', '--quiet', '-m', 'backend rename fixture'])
    const target = execFileSync(gitPath, ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    await assert.rejects(runOnce(f.config, { getTarget: async () => target }), /Requires manual deployment/)
    assert.equal((await f.state()).frontendCommit, base)
    await f.unchanged()
  } finally { await f.close() }
})
