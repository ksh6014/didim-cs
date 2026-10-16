import http from "node:http"
import { createReadStream, statSync } from "node:fs"
import path from "node:path"

const host = process.env.TRANSFER_HOST || "127.0.0.1"
const port = Number(process.env.TRANSFER_PORT || 8765)
const fileName = process.env.TRANSFER_FILE || "cs-manager-root-hotfix-20261014.zip"
const filePath = path.resolve("deployment", fileName)

http.createServer((req, res) => {
  if (req.url !== `/${fileName}`) {
    res.writeHead(404).end("Not found")
    return
  }

  const { size } = statSync(filePath)
  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Length": size,
    "Content-Disposition": `attachment; filename=${fileName}`,
  })
  createReadStream(filePath).pipe(res)
}).listen(port, host, () => {
  console.log(`http://${host}:${port}/${fileName}`)
})
