import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

export const sha = data => crypto.createHash('sha256').update(data).digest('hex')
export const textSha = data => sha(data.toString('utf8').replace(/\r\n/g, '\n'))
export const exists = async file => fs.lstat(file).then(() => true, error => {
  if (error.code === 'ENOENT') return false
  throw error
})
export async function atomicWrite(file, data) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`
  try { await fs.writeFile(temp, data); await fs.rename(temp, file) }
  finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error }) }
}
export const writeJson = (file, value) => atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`)
export function relativeFile(name) {
  if (!name || name.includes('\\') || name.includes(':') || name.includes('\0') || name.startsWith('/') || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error(`Unsafe path: ${name}`)
  return name
}
export async function safeFile(root, name) {
  relativeFile(name)
  const absoluteRoot = path.resolve(root)
  if ((await fs.lstat(absoluteRoot)).isSymbolicLink()) throw new Error('Root must not be a junction/symlink')
  let cursor = absoluteRoot
  for (const part of name.split('/')) {
    cursor = path.join(cursor, part)
    if (await exists(cursor)) {
      const stat = await fs.lstat(cursor)
      if (stat.isSymbolicLink()) throw new Error(`Junction/symlink is not allowed: ${name}`)
    }
  }
  return cursor
}
export const isInput = name => name.startsWith('src/') || name.startsWith('public/') || ['index.html', 'vite.config.js'].includes(name)
export async function inputFiles(root) {
  const result = []
  for (const directory of ['src', 'public']) {
    if (await exists(path.join(root, directory))) result.push(...(await walk(path.join(root, directory))).map(name => `${directory}/${name}`))
  }
  for (const file of ['index.html', 'vite.config.js']) if (await exists(path.join(root, file))) result.push(file)
  return result.sort()
}
export function assertPolicy(names) {
  for (const name of names) {
    relativeFile(name)
    if (/(^|\/)(\.env(?:\..*)?|uploads|node_modules|generated|downloads)(\/|$)|\.(db|sqlite|sqlite3|apk|zip|jks|keystore)$/i.test(name)) throw new Error(`Runtime data is not deployable: ${name}`)
    const tooling = name.startsWith('scripts/git-deploy/') || name.startsWith('docs/') || ['README.md', 'SERVER-INSTALL.md', '.gitignore', '.oxlintrc.json'].includes(name)
    if (!isInput(name) && !tooling) throw new Error(`Requires manual deployment (backend/database/dependencies): ${name}`)
  }
}
export async function walk(root, prefix = '') {
  const result = []
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = prefix + entry.name
    if (entry.isSymbolicLink()) throw new Error(`Symlink in release: ${name}`)
    if (entry.isDirectory()) result.push(...await walk(root, `${name}/`))
    else if (entry.isFile()) result.push(name)
    else throw new Error(`Non-file release entry: ${name}`)
  }
  return result.sort()
}
export async function fingerprints(root, files) {
  const result = {}
  for (const name of files) result[name] = sha(await fs.readFile(await safeFile(root, name)))
  return result
}
export async function assertUnchanged(root, expected) {
  for (const [name, hash] of Object.entries(expected)) {
    const file = await safeFile(root, name)
    if (!await exists(file) || sha(await fs.readFile(file)) !== hash) throw new Error(`Runtime changed outside Git deployment: ${name}`)
  }
}
async function copyAtomic(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true })
  const temp = `${to}.${crypto.randomUUID()}.tmp`
  try { await fs.copyFile(from, temp); await fs.rename(temp, to) }
  finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error }) }
}
export async function checkHttp(url, expectedFiles) {
  for (const [name, expectedHash] of Object.entries(expectedFiles)) {
    if (!name.startsWith('dist/')) continue
    const relative = name === 'dist/index.html' ? '' : name.slice(5)
    const response = await fetch(new URL(relative.split('/').map(encodeURIComponent).join('/'), url), { signal: AbortSignal.timeout(10000), cache: 'no-store' })
    if (!response.ok || sha(Buffer.from(await response.arrayBuffer())) !== expectedHash) throw new Error(`HTTP content verification failed: ${name}`)
  }
}
export async function restore(config, journal) {
  // Only paths recorded before mutation are restored; new hashed assets can remain unreferenced.
  for (const [name, entry] of Object.entries(journal.before).sort(([a], [b]) => (a === 'dist/index.html') - (b === 'dist/index.html'))) {
    const target = await safeFile(config.runtimeRoot, name)
    if (entry === null) {
      if (name.startsWith('dist/assets/')) continue
      if (await exists(target)) await fs.unlink(target)
    } else {
      const backup = await safeFile(journal.backupRoot, name)
      if (sha(await fs.readFile(backup)) !== entry) throw new Error(`Backup is damaged: ${name}`)
      await copyAtomic(backup, target)
    }
  }
  await writeJson(path.join(config.controlRoot, 'state.json'), journal.previousState)
}
export async function recover(config) {
  const journalFile = path.join(config.controlRoot, 'pending.json')
  if (!await exists(journalFile)) return false
  const journal = JSON.parse(await fs.readFile(journalFile, 'utf8'))
  const backups = path.join(config.controlRoot, 'backups') + path.sep
  if (!path.resolve(journal.backupRoot).startsWith(backups)) throw new Error('Recovery backup path is outside the control folder')
  await restore(config, journal)
  await fs.rename(journalFile, path.join(journal.backupRoot, 'recovered-journal.json'))
  return true
}
export async function applyRelease(config, state, releaseRoot, targetCommit) {
  await assertUnchanged(config.runtimeRoot, state.runtimeFiles)
  const inputs = await inputFiles(releaseRoot)
  const outputs = (await walk(path.join(releaseRoot, 'dist'))).map(name => `dist/${name}`)
  assertPolicy(inputs)
  if (!outputs.includes('dist/index.html')) throw new Error('Build produced no index.html')
  for (const name of outputs) {
    if (!name.startsWith('dist/assets/')) assertPolicy([`public/${name.slice(5)}`])
    relativeFile(name)
  }
  const files = [...inputs, ...outputs]
  const hashes = await fingerprints(releaseRoot, files)
  const before = {}
  for (const name of new Set([...Object.keys(state.runtimeFiles).filter(name => isInput(name) || (name.startsWith('dist/') && !name.startsWith('dist/assets/'))), ...files])) {
    const target = await safeFile(config.runtimeRoot, name)
    before[name] = await exists(target) ? sha(await fs.readFile(target)) : null
    if (!(name in state.runtimeFiles) && before[name] !== null && before[name] !== hashes[name]) throw new Error(`Unmanaged file collision: ${name}`)
  }
  const backupRoot = path.join(config.controlRoot, 'backups', `${Date.now()}-${targetCommit.slice(0, 12)}-${crypto.randomUUID()}`)
  await fs.mkdir(backupRoot, { recursive: true })
  for (const [name, hash] of Object.entries(before)) {
    if (hash === null) continue
    const destination = await safeFile(backupRoot, name)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(await safeFile(config.runtimeRoot, name), destination)
    if (sha(await fs.readFile(destination)) !== hash) throw new Error(`Backup verification failed: ${name}`)
  }
  const journal = { targetCommit, backupRoot, before, previousState: state }
  const pending = path.join(config.controlRoot, 'pending.json')
  await writeJson(pending, journal)
  try {
    await assertUnchanged(config.runtimeRoot, state.runtimeFiles)
    if (await exists(path.join(config.controlRoot, 'PAUSED'))) throw new Error('Deployment paused before apply')
    // New assets/resources and sources first, HTML last. Keep previous hashed assets.
    for (const name of files.filter(name => name !== 'dist/index.html')) {
      await copyAtomic(await safeFile(releaseRoot, name), await safeFile(config.runtimeRoot, name))
    }
    for (const name of Object.keys(before).filter(name => !(name in hashes) && !name.startsWith('dist/assets/'))) {
      const target = await safeFile(config.runtimeRoot, name)
      if (await exists(target)) await fs.unlink(target)
    }
    await copyAtomic(path.join(releaseRoot, 'dist/index.html'), path.join(config.runtimeRoot, 'dist/index.html'))
    await assertUnchanged(config.runtimeRoot, hashes)
    await checkHttp(config.healthUrl, Object.fromEntries(outputs.map(name => [name, hashes[name]])))
    const next = { ...state, acceptedCommit: targetCommit, frontendCommit: targetCommit, runtimeFiles: hashes, lastBackup: backupRoot, appliedAt: new Date().toISOString(), failedCommit: null }
    await writeJson(path.join(config.controlRoot, 'state.json'), next)
    await fs.rename(pending, path.join(backupRoot, 'applied-journal.json'))
    return next
  } catch (error) {
    await restore(config, journal)
    await fs.rename(pending, path.join(backupRoot, 'rolled-back-journal.json'))
    throw new Error(`Deployment failed; previous files restored: ${error.message}`, { cause: error })
  }
}
