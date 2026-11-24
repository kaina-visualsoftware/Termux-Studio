import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { topics, makeRequest, decodeMessage, matchesBearer, validateTransportEnv } from '../remote/protocol.mjs'
import { createWorkspace } from '../remote/workspace.mjs'
import { RpcOverMqtt } from '../remote/rpc.mjs'
import { dispatchMcp } from '../remote/mcp-core.mjs'

test('tópicos MQTT e formato de mensagens por dispositivo', () => {
  assert.throws(() => topics('../bypass'))
  const t = topics('celular01')
  assert.match(t.request, /celular01\/request$/)
  const req = makeRequest('celular01', 'read_file', { project: 'app', file: 'index.js' })
  assert.deepEqual(decodeMessage(Buffer.from(JSON.stringify(req))), req)
  assert.throws(() => makeRequest('celular01', 'execute_shell'))
})

test('credenciais nunca podem ser passadas na URL MQTT nem em transporte puro', () => {
  const env = { DEVICE_ID: 'celular01', MQTT_USERNAME: 'celular01', MQTT_PASSWORD: 'secret', MQTT_URL: 'mqtt://host:1883' }
  assert.throws(() => validateTransportEnv(env, 'agent'), /mqtts/)
  assert.throws(() => validateTransportEnv({ ...env, MQTT_URL: 'mqtts://user:pass@host:8883' }, 'agent'))
  assert.equal(validateTransportEnv({ ...env, MQTT_URL: 'mqtts://host:8883' }, 'agent'), 'mqtts://host:8883')
  assert.equal(matchesBearer('Bearer ' + 'a'.repeat(40), 'a'.repeat(40)), true)
  assert.equal(matchesBearer('Bearer ' + 'a'.repeat(39), 'a'.repeat(40)), false)
})

test('workspace bloqueia leitura de segredos, links e escrita sem autorização', async () => {
  const root = await mkdtemp(join(tmpdir(), 'termux-remote-'))
  try {
    await mkdir(join(root, 'app'))
    await writeFile(join(root, 'app', 'index.ts'), 'export const x = 1')
    await writeFile(join(root, 'app', '.env'), 'KEY=secret')
    await symlink('/etc/passwd', join(root, 'app', 'linked.txt'))
    const run = createWorkspace({ root })
    assert.deepEqual(await run('list_projects'), { projects: ['app'] })
    assert.deepEqual(await run('read_file', { project: 'app', file: 'index.ts' }), { content: 'export const x = 1' })
    await assert.rejects(() => run('read_file', { project: 'app', file: '.env' }))
    await assert.rejects(() => run('read_file', { project: 'app', file: 'linked.txt' }))
    await assert.rejects(() => run('read_file', { project: '../etc', file: 'passwd' }))
    await assert.rejects(() => run('write_file', { project: 'app', file: 'index.ts', content: 'bad' }))
    await assert.rejects(() => run('run_tests', { project: 'app' }))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('escrita habilitada apenas em projeto confiável e auditada', async () => {
  const root = await mkdtemp(join(tmpdir(), 'termux-remote-'))
  try {
    await mkdir(join(root, 'app'))
    await mkdir(join(root, 'other'))
    const events = []
    const run = createWorkspace({ root, allowWrite: true, trustedProjects: ['app'], onAudit: e => events.push(e) })
    assert.deepEqual(await run('write_file', { project: 'app', file: 'main.ts', content: 'const ok = true' }), { saved: true })
    assert.equal(await readFile(join(root, 'app', 'main.ts'), 'utf8'), 'const ok = true')
    await assert.rejects(() => run('write_file', { project: 'other', file: 'main.ts', content: 'bad' }))
    assert.equal(events[0].outcome, 'ok')
    assert.equal(events[1].outcome, 'denied')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('RPC correlaciona resposta e impede resposta de outro dispositivo', async () => {
  class FakeMqtt extends EventEmitter {
    connected = true
    publish(topic, payload, opts, cb) { this.topic = topic; this.req = JSON.parse(payload); cb(null) }
  }
  const bus = new FakeMqtt()
  const rpc = new RpcOverMqtt(bus, 'celular01', { timeoutMs: 1500 })
  const promise = rpc.call('list_projects')
  assert.match(bus.topic, /celular01\/request$/)
  bus.emit('message', topics('celular01').response, Buffer.from(JSON.stringify({ id: bus.req.id, device: 'celular02', ok: true, result: { projects: ['bad'] } })))
  assert.equal(rpc.pending.size, 1)
  bus.emit('message', topics('celular01').response, Buffer.from(JSON.stringify({ id: bus.req.id, device: 'celular01', ok: true, result: { projects: ['ok'] } })))
  assert.deepEqual(await promise, { projects: ['ok'] })
  assert.equal(rpc.pending.size, 0)
})

test('MCP envia chamadas por RPC e não permite ferramenta desconhecida', async () => {
  const rpc = { call: async (method, args) => ({ method, args }) }
  const init = await dispatchMcp({ jsonrpc: '2.0', id: 1, method: 'initialize' }, rpc)
  assert.equal(init.result.serverInfo.name, 'termux-studio-remote')
  const call = await dispatchMcp({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'git_status', arguments: { project: 'app' } } }, rpc)
  assert.match(call.result.content[0].text, /git_status/)
  const blocked = await dispatchMcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'execute_shell', arguments: {} } }, rpc)
  assert.equal(blocked.result.isError, true)
})
