import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function getPort() {
  const socket = net.createServer()
  await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  return port
}
async function runServer(run, allowedOrigin = 'https://kaina-visualsoftware.github.io') {
  const dir = await mkdtemp(join(tmpdir(), 'studio-cors-'))
  const port = await getPort()
  const url = `http://127.0.0.1:${port}`
  const proc = spawn(process.execPath, [new URL('../server/index.mjs', import.meta.url).pathname], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), PROJECTS_DIR: dir, ALLOWED_ORIGIN: allowedOrigin },
    stdio: 'ignore',
  })
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      try { await fetch(url + '/api/dashboard'); break } catch {
        if (proc.exitCode !== null) throw Error('Servidor não iniciou')
        await new Promise(resolve => setTimeout(resolve, 60))
      }
      if (attempt === 49) throw Error('Servidor não respondeu')
    }
    await run(url)
  } finally {
    proc.kill('SIGTERM')
    await new Promise(resolve => { if (proc.exitCode !== null) return resolve(); proc.once('exit', resolve); setTimeout(resolve, 1500).unref() })
    await rm(dir, { recursive: true, force: true })
  }
}

test('API libera a origem exata e inclui credenciais no CORS', async () => {
  await runServer(async url => {
    const response = await fetch(url + '/api/dashboard', { headers: { Origin: 'https://kaina-visualsoftware.github.io' } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://kaina-visualsoftware.github.io')
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
    assert.equal(response.headers.get('vary'), 'Origin')
  })
})
test('API rejeita origem não autorizada', async () => {
  await runServer(async url => {
    const response = await fetch(url + '/api/dashboard', { headers: { Origin: 'https://site-malicioso.example' } })
    assert.equal(response.status, 403)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
  })
})
test('API não permite CORS cross-origin sem configuração', async () => {
  await runServer(async url => {
    const response = await fetch(url + '/api/dashboard', { headers: { Origin: 'https://kaina-visualsoftware.github.io' } })
    assert.equal(response.status, 403)
  }, '')
})
test('API reconhece preflight somente para origem autorizada', async () => {
  await runServer(async url => {
    const accepted = await fetch(url + '/api/dashboard', { method: 'OPTIONS', headers: { Origin: 'https://kaina-visualsoftware.github.io' } })
    assert.equal(accepted.status, 204)
    assert.equal(accepted.headers.get('access-control-allow-methods'), 'GET, OPTIONS')
    const blocked = await fetch(url + '/api/dashboard', { method: 'OPTIONS', headers: { Origin: 'https://bad.example' } })
    assert.equal(blocked.status, 403)
  })
})
