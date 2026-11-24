import { randomUUID, timingSafeEqual } from 'node:crypto'

export const PREFIX = 'termux-studio/v1/device'
export const METHODS = Object.freeze(['list_projects', 'read_file', 'write_file', 'run_tests', 'run_build', 'git_status'])
export const MAX_MESSAGE_BYTES = 256_000

export function validateDeviceId(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,47}$/.test(value)) throw new Error('DEVICE_ID inválido')
  return value
}

export function topics(device) {
  const id = validateDeviceId(device)
  return { request: `${PREFIX}/${id}/request`, response: `${PREFIX}/${id}/response` }
}

export function decodeMessage(payload) {
  if (Buffer.byteLength(payload) > MAX_MESSAGE_BYTES) throw new Error('Mensagem muito grande')
  const value = JSON.parse(payload.toString('utf8'))
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Mensagem inválida')
  if (typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/.test(value.id)) throw new Error('ID inválido')
  if (typeof value.device !== 'string') throw new Error('Dispositivo ausente')
  validateDeviceId(value.device)
  return value
}

export function makeRequest(device, method, args = {}) {
  validateDeviceId(device)
  if (!METHODS.includes(method)) throw new Error('Ferramenta não permitida')
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Argumentos inválidos')
  return { id: randomUUID(), device, method, args, issuedAt: Date.now() }
}

export function matchesBearer(header, secret) {
  if (typeof secret !== 'string' || secret.length < 32) return false
  const prefix = 'Bearer '
  if (typeof header !== 'string' || !header.startsWith(prefix)) return false
  const supplied = Buffer.from(header.slice(prefix.length))
  const expected = Buffer.from(secret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function validateTransportEnv(env, kind) {
  const parsed = new URL(env.MQTT_URL || '')
  if (parsed.protocol !== 'mqtts:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('MQTT_URL exige mqtts://host:8883 sem credenciais na URL')
  }
  if (!env.MQTT_USERNAME || !env.MQTT_PASSWORD) throw new Error('Configure MQTT_USERNAME e MQTT_PASSWORD')
  if (kind === 'gateway') {
    if (!env.REMOTE_MCP_TOKEN || env.REMOTE_MCP_TOKEN.length < 32) throw new Error('REMOTE_MCP_TOKEN deve ter ao menos 32 caracteres')
    validateDeviceId(env.DEVICE_ID)
  } else if (kind === 'agent') {
    validateDeviceId(env.DEVICE_ID)
    if (env.MQTT_USERNAME !== env.DEVICE_ID) throw new Error('Agente deve usar MQTT_USERNAME igual ao DEVICE_ID (ACL do broker)')
  }
  return parsed.toString()
}
