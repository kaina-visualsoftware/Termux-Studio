import http from 'node:http'
import os from 'node:os'
import { readFile, stat, realpath } from 'node:fs/promises'
import { resolve, extname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSettings, listProjects, staticPath } from './core.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const distDir = resolve(here, '../dist')
const { projectsRoot, editorUrl, healthUrl } = getSettings(process.env)
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4173)
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error('Segurança: HOST deve ser um endereço loopback. Use túnel com autenticação.')
  process.exit(1)
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('PORT deve estar entre 1024 e 65535')
  process.exit(1)
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
}

function json(res, code, payload) {
  res.writeHead(code, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

async function editorHealth() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1700) })
    if (!response.ok) return false
    const data = await response.json()
    return data.status === 'alive' || data.status === 'expired'
  } catch { return false }
}

async function serveFile(res, requestedPath) {
  const pathname = requestedPath === '/' ? '/index.html' : requestedPath
  const full = staticPath(distDir, pathname)
  if (!full) return json(res, 400, { error: 'Caminho inválido' })
  let data
  let target = full
  try {
    const meta = await stat(target)
    if (!meta.isFile()) throw new Error('not a file')
    const actual = await realpath(target)
    const rel = relative(distDir, actual)
    if (rel === '..' || rel.startsWith('..' + sep)) return json(res, 403, { error: 'Bloqueado' })
    data = await readFile(actual)
  } catch {
    if (pathname === '/index.html') return json(res, 503, { error: 'Execute npm run build primeiro' })
    if (extname(pathname)) return json(res, 404, { error: 'Arquivo inexistente' })
    target = resolve(distDir, 'index.html')
    try { data = await readFile(target) } catch { return json(res, 503, { error: 'Execute npm run build primeiro' }) }
  }
  res.writeHead(200, { ...securityHeaders, 'Content-Type': mimeTypes[extname(target)] || 'application/octet-stream' })
  res.end(data)
}

http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido' })
    const url = new URL(req.url || '/', `http://${host}:${port}`)
    if (url.pathname === '/api/dashboard') {
      const [projects, editorOnline] = await Promise.all([listProjects(projectsRoot), editorHealth()])
      return json(res, 200, {
        projects,
        editor: { url: editorUrl, online: editorOnline },
        device: { platform: process.platform, arch: process.arch, hostname: os.hostname(), uptimeSeconds: Math.floor(os.uptime()), totalMemory: os.totalmem(), freeMemory: os.freemem() },
        checkedAt: new Date().toISOString(),
      })
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Rota inexistente' })
    return await serveFile(res, url.pathname)
  } catch (error) {
    console.error('Erro ao atender solicitação:', error.message)
    return json(res, 500, { error: 'Falha interna' })
  }
}).listen(port, host, () => {
  console.log(`Termux Studio iniciado em http://${host}:${port}`)
  console.log(`Projetos: ${projectsRoot}`)
})
