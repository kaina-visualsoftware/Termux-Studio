import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, open, readFile, rm, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { validateDeviceId, validateTransportEnv } from './protocol.mjs'

const MAX_TTL_MS = 10 * 60_000
const CODE_PATTERN = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/

export function pairingKey(hex) {
  if (typeof hex !== 'string' || !/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error('PAIRING_MASTER_KEY deve conter 64 caracteres hexadecimais aleatórios')
  }
  return Buffer.from(hex, 'hex')
}

export function validatePairingConfig({ deviceId, mqttUrl, password, ttlMs }) {
  validateDeviceId(deviceId)
  validateTransportEnv({ DEVICE_ID: deviceId, MQTT_URL: mqttUrl, MQTT_USERNAME: deviceId, MQTT_PASSWORD: password }, 'agent')
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(password)) throw new Error('Senha MQTT precisa de 32 a 128 caracteres seguros')
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) throw new Error('Duração máxima do pareamento: 10 minutos')
}

function digest(value) { return createHash('sha256').update(value).digest() }
function sealed(value, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()])
  return { iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
}
function unseal(value, key) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'))
}

export async function issuePairing({ directory, key, deviceId, mqttUrl, mqttPassword, ttlMs = MAX_TTL_MS, now = Date.now() }) {
  validatePairingConfig({ deviceId, mqttUrl, password: mqttPassword, ttlMs })
  const encryptionKey = pairingKey(key)
  const nonce = randomBytes(12).toString('hex')
  const secret = randomBytes(32).toString('base64url')
  const code = `${nonce}.${secret}`
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const data = {
    version: 1, deviceId, until: now + ttlMs,
    codeHash: digest(code).toString('base64'),
    credential: sealed({ deviceId, mqttUrl, mqttUsername: deviceId, mqttPassword }, encryptionKey),
  }
  // wx prevents overwriting a pending enrollment. State stays outside the repository.
  const file = join(resolve(directory), `${nonce}.json`)
  const handle = await open(file, 'wx', 0o600)
  try { await handle.writeFile(JSON.stringify(data)); await handle.sync() } finally { await handle.close() }
  return { code, deviceId, expiresAt: new Date(data.until).toISOString() }
}

export async function redeemPairing({ directory, key, deviceId, code, now = Date.now() }) {
  validateDeviceId(deviceId)
  const match = typeof code === 'string' ? CODE_PATTERN.exec(code) : null
  if (!match) throw new Error('Código inválido ou expirado')
  const encryptionKey = pairingKey(key)
  const file = join(resolve(directory), `${match[1]}.json`)
  const lockFile = `${file}.lock`
  let lock
  try {
    lock = await open(lockFile, 'wx', 0o600)
  } catch {
    throw new Error('Código inválido ou em utilização')
  }
  try {
    let data
    try { data = JSON.parse(await readFile(file, 'utf8')) }
    catch { throw new Error('Código inválido ou expirado') }
    const supplied = digest(code)
    const expected = Buffer.from(data.codeHash || '', 'base64')
    const valid = supplied.length === expected.length && timingSafeEqual(supplied, expected)
    if (!valid || data.deviceId !== deviceId || data.version !== 1) throw new Error('Código inválido ou expirado')
    if (!Number.isSafeInteger(data.until) || now > data.until) {
      await unlink(file).catch(() => {})
      throw new Error('Código inválido ou expirado')
    }
    const credential = unseal(data.credential, encryptionKey)
    if (credential.deviceId !== deviceId || credential.mqttUsername !== deviceId) throw new Error('Credencial inconsistente')
    // One-time redemption persists across restarts. A crash after unlink means a new code is needed.
    await unlink(file)
    return credential
  } finally {
    await lock.close()
    await rm(lockFile, { force: true })
  }
}
