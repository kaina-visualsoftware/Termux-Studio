import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { issuePairing, redeemPairing, pairingKey } from '../remote/pairing-core.mjs'
import { createPairingServer } from '../remote/pairing-server.mjs'
import { enrollAgent } from '../remote/pair-agent.mjs'

const key = 'a'.repeat(64)
const conf = { deviceId: 'meutermux01', mqttUrl: 'mqtts://mqtt.example.com:8883', mqttPassword: 'a_secure_password_in_server_0123456789' }
async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'studio-pair-'))
  try { await run(directory) } finally { await rm(directory, { recursive: true, force: true }) }
}
async function serve(directory, run) {
  const server = createPairingServer({ directory, key })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try { await run(`http://127.0.0.1:${server.address().port}/v1/pair`) }
  finally { await new Promise(resolve => server.close(resolve)) }
}
const jsonFetch = (url, deviceId, code, options = {}) => fetch(url, { method:'POST', headers: { 'content-type':'application/json', ...options.headers }, body: JSON.stringify({ deviceId, code }) })

test('Código expira e não armazena a senha MQTT em texto puro', async () => {
  await fixture(async directory => {
    const issued = await issuePairing({ directory, key, ...conf, now: 1000, ttlMs: 60000 })
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(directory)
    assert.equal(files.length, 1)
    const content = await readFile(join(directory, files[0]), 'utf8')
    assert.doesNotMatch(content, /a_secure_password_in_server/)
    assert.doesNotMatch(content, new RegExp(issued.code.replace('.', '\\.')))
    const metadata = await stat(join(directory, files[0]))
    assert.equal(metadata.mode & 0o077, 0)
    await assert.rejects(() => redeemPairing({ directory, key, code: issued.code, deviceId: conf.deviceId, now: 61001 }), /expirado/)
  })
})

test('Código único e identidade vinculada ao dispositivo', async () => {
  await fixture(async directory => {
    const { code } = await issuePairing({ directory, key, ...conf })
    await assert.rejects(() => redeemPairing({ directory, key, code, deviceId: 'outro01' }), /Código inválido/)
    const result = await redeemPairing({ directory, key, code, deviceId: conf.deviceId })
    assert.equal(result.mqttPassword, conf.mqttPassword)
    assert.equal(result.mqttUsername, conf.deviceId)
    await assert.rejects(() => redeemPairing({ directory, key, code, deviceId: conf.deviceId }), /Código inválido/)
  })
})

test('Duas tentativas paralelas não conseguem usar o mesmo código', async () => {
  await fixture(async directory => {
    const { code } = await issuePairing({ directory, key, ...conf })
    const attempts = await Promise.allSettled([
      redeemPairing({ directory, key, code, deviceId: conf.deviceId }),
      redeemPairing({ directory, key, code, deviceId: conf.deviceId }),
    ])
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1)
  })
})

test('Servidor local rejeita navegadores, códigos incorretos e reproduções', async () => {
  await fixture(async directory => {
    const { code } = await issuePairing({ directory, key, ...conf })
    await serve(directory, async url => {
      const browser = await jsonFetch(url, conf.deviceId, code, { headers: { Origin: 'https://evil.example' } })
      assert.equal(browser.status, 403)
      const wrong = await jsonFetch(url, conf.deviceId, 'bad')
      assert.equal(wrong.status, 403)
      const allowed = await jsonFetch(url, conf.deviceId, code)
      assert.equal(allowed.status, 200)
      assert.equal(allowed.headers.get('cache-control'), 'no-store')
      assert.equal((await allowed.json()).mqttPassword, conf.mqttPassword)
      const replay = await jsonFetch(url, conf.deviceId, code)
      assert.equal(replay.status, 403)
    })
  })
})

test('Instalador exige HTTPS, cria config 0600 e não sobrescreve identidade', async () => {
  await fixture(async directory => {
    const dest = join(directory, '.env.agent')
    const fakeFetch = async (_, options) => {
      assert.equal(options.redirect, 'error')
      assert.equal(options.method, 'POST')
      return { ok: true, text: async () => JSON.stringify({ deviceId: conf.deviceId, mqttUrl: conf.mqttUrl, mqttUsername: conf.deviceId, mqttPassword: conf.mqttPassword }) }
    }
    await assert.rejects(() => enrollAgent({ pairingUrl: 'http://example.com/v1/pair', deviceId: conf.deviceId, code: 'x', outputFile: dest, fetchImpl: fakeFetch }), /HTTPS/)
    const result = await enrollAgent({ pairingUrl: 'https://pair.example.com/v1/pair', deviceId: conf.deviceId, code: 'x', outputFile: dest, fetchImpl: fakeFetch })
    assert.equal(result.deviceId, conf.deviceId)
    const cfg = await readFile(dest, 'utf8')
    assert.match(cfg, /REMOTE_ALLOW_WRITE=0/)
    assert.match(cfg, /REMOTE_ALLOW_EXECUTE=0/)
    assert.equal((await stat(dest)).mode & 0o077, 0)
    await assert.rejects(() => enrollAgent({ pairingUrl: 'https://pair.example.com/v1/pair', deviceId: conf.deviceId, code: 'x', outputFile: dest, fetchImpl: fakeFetch }), /EEXIST/)
    assert.equal(await readFile(dest, 'utf8'), cfg)
  })
})

test('Validações rejeitam segredo fraco e MQTT sem TLS', async () => {
  assert.throws(() => pairingKey('bad'), /PAIRING_MASTER_KEY/)
  await fixture(async directory => {
    await assert.rejects(() => issuePairing({ directory, key, ...conf, mqttUrl: 'mqtt://plaintext:1883' }), /mqtts/)
    await assert.rejects(() => issuePairing({ directory, key, ...conf, ttlMs: 700_000 }), /10 minutos/)
  })
})
