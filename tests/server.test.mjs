import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const entry = join(root, 'server/index.mjs')

async function availablePort() {
  const server = net.createServer()
  await new Promise((ok, fail) => server.once('error', fail).listen(0, '127.0.0.1', ok))
  const port = server.address().port
  await new Promise((ok, fail) => server.close(err => err ? fail(err) : ok()))
  return port
}

async function withServer(run) {
  const projects = await mkdtemp(join(tmpdir(), 'termux-studio-http-'))
  const port = await availablePort()
  const base = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), PROJECTS_DIR: projects },
    stdio: 'ignore',
  })
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (child.exitCode !== null) throw new Error('Servidor terminou antes de iniciar')
      try { await fetch(`${base}/api/dashboard`); break } catch { await new Promise(ok => setTimeout(ok, 80)) }
      if (attempt === 59) throw new Error('Servidor não iniciou')
    }
    await run({ base, projects })
  } finally {
    child.kill('SIGTERM')
    await new Promise(ok => { if (child.exitCode !== null) return ok(); child.once('exit', ok); setTimeout(ok, 2000).unref() })
    await rm(projects, { recursive: true, force: true })
  }
}

test('GET dashboard limita a listagem de projetos e entrega cabeçalhos de segurança', async () => {
  await withServer(async ({ base, projects }) => {
    await mkdir(join(projects, 'meu-app'))
    await mkdir(join(projects, '.privado'))
    const response = await fetch(`${base}/api/dashboard`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/)
    const dashboard = await response.json()
    assert.deepEqual(dashboard.projects.map(project => project.name), ['meu-app'])
    assert.equal(typeof dashboard.editor.online, 'boolean')
    assert.equal(dashboard.editor.url, 'http://127.0.0.1:8080')
    assert.ok(dashboard.device.platform)
  })
})

test('API rejeita métodos de escrita e rotas não previstas', async () => {
  await withServer(async ({ base }) => {
    const post = await fetch(`${base}/api/dashboard`, { method: 'POST' })
    assert.equal(post.status, 405)
    const unknown = await fetch(`${base}/api/execute`)
    assert.equal(unknown.status, 404)
    const notFound = await unknown.json()
    assert.equal(notFound.error, 'Rota inexistente')
  })
})

test('arquivo estático inexistente não revela arquivos do sistema', async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(`${base}/assets/inexistente.js`)
    assert.equal(response.status, 404)
    const body = await response.json()
    assert.equal(body.error, 'Arquivo inexistente')
  })
})
