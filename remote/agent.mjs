import mqtt from 'mqtt'
import { createWorkspace } from './workspace.mjs'
import { validateTransportEnv, topics, decodeMessage, METHODS, MAX_MESSAGE_BYTES } from './protocol.mjs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const env = process.env
const mqttUrl = validateTransportEnv(env, 'agent')
const device = env.DEVICE_ID
const channel = topics(device)
const workspace = createWorkspace({
  root: env.PROJECTS_DIR || join(homedir(), 'projects'),
  allowWrite: env.REMOTE_ALLOW_WRITE === '1',
  allowExecute: env.REMOTE_ALLOW_EXECUTE === '1',
  trustedProjects: (env.REMOTE_TRUSTED_PROJECTS || '').split(',').map(x => x.trim()).filter(Boolean),
  onAudit(entry) { console.error(JSON.stringify({ audit: entry })) },
})
const client = mqtt.connect(mqttUrl, {
  username: env.MQTT_USERNAME,
  password: env.MQTT_PASSWORD,
  clientId: `ts-agent-${device}`,
  clean: true,
  rejectUnauthorized: true,
  reconnectPeriod: 3000,
  connectTimeout: 12_000,
  keepalive: 30,
  queueQoSZero: false,
})
let running = 0
const seen = new Map()
client.on('connect', () => {
  console.error(`Termux Studio Agent conectado: ${device}`)
  client.subscribe(channel.request, { qos: 1 }, error => {
    if (error) console.error('Falha na assinatura MQTT:', error.message)
  })
})
client.on('error', error => console.error('Erro MQTT:', error.message))
client.on('message', async (topic, raw, packet) => {
  if (topic !== channel.request || packet.retain || raw.length > MAX_MESSAGE_BYTES) return
  let message
  try { message = decodeMessage(raw) } catch { return }
  if (message.device !== device || !METHODS.includes(message.method)) return
  if (!Number.isSafeInteger(message.issuedAt) || Math.abs(Date.now() - message.issuedAt) > 30_000) return
  if (seen.has(message.id) || running >= 2) return
  seen.set(message.id, Date.now())
  if (seen.size > 1024) for (const [id, at] of seen) if (Date.now() - at > 120_000) seen.delete(id)
  running++
  let answer
  try { answer = { id: message.id, device, ok: true, result: await workspace(message.method, message.args || {}) } }
  catch (error) { answer = { id: message.id, device, ok: false, error: String(error.message || 'Falha na tarefa').slice(0, 250) } }
  finally { running-- }
  const serialized = JSON.stringify(answer)
  if (Buffer.byteLength(serialized) > MAX_MESSAGE_BYTES) {
    answer = { id: message.id, device, ok: false, error: 'Resultado muito grande' }
  }
  client.publish(channel.response, JSON.stringify(answer), { qos: 1, retain: false }, error => {
    if (error) console.error('Não foi possível publicar o resultado:', error.message)
  })
})
process.on('SIGTERM', () => { client.end(true); process.exit(0) })
process.on('SIGINT', () => { client.end(true); process.exit(0) })
