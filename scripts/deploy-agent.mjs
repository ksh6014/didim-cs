import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, "..")
const token = fs.readFileSync(path.join(projectDir, ".deploy-token"), "utf8").trim()
const host = process.env.DEPLOY_HOST || "100.115.133.60"
const port = Number(process.env.DEPLOY_PORT || 8787)
const deploymentDir = path.join(projectDir, "deployment")
const archivePath = path.join(deploymentDir, "incoming-release.zip")
const lockPath = path.join(deploymentDir, "deployment.lock")
let busy = false

fs.mkdirSync(deploymentDir, { recursive: true })

function send(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(payload))
}

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, busy: busy || fs.existsSync(lockPath) })
  }

  if (req.method !== "POST" || req.url !== "/deploy") {
    return send(res, 404, { error: "Not found" })
  }

  if (req.headers.authorization !== `Bearer ${token}`) {
    return send(res, 401, { error: "Unauthorized" })
  }

  if (busy || fs.existsSync(lockPath)) return send(res, 409, { error: "Deployment already running" })

  const expectedLength = Number(req.headers["content-length"] || 0)
  if (!Number.isSafeInteger(expectedLength) || expectedLength <= 0 || expectedLength > 30 * 1024 * 1024) {
    return send(res, 413, { error: "Invalid deployment size" })
  }

  busy = true
  const output = fs.createWriteStream(archivePath, { flags: "w" })
  let received = 0

  req.on("data", (chunk) => {
    received += chunk.length
    if (received > 30 * 1024 * 1024) req.destroy()
  })
  req.pipe(output)

  output.on("finish", () => {
    if (received !== expectedLength) {
      busy = false
      return send(res, 400, { error: "Incomplete deployment" })
    }

    fs.writeFileSync(lockPath, new Date().toISOString())
    send(res, 202, { ok: true, message: "Deployment accepted" })
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(scriptDir, "apply-deployment.ps1"), "-Archive", archivePath],
      { cwd: projectDir, detached: true, stdio: "ignore", windowsHide: true }
    )
    child.unref()
    busy = false
  })

  output.on("error", () => {
    busy = false
    if (!res.headersSent) send(res, 500, { error: "Could not save deployment" })
  })
}).listen(port, host, () => {
  console.log(`CS deploy agent listening on http://${host}:${port}`)
})
