import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { open, mkdir } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { homedir } from 'node:os'
import { validateDeviceId, validateTransportEnv } from './protocol.mjs'

async function enterCode() {
  if (process.env.PAIRING_CODE) return process.env.PAIRING_CODE
  if (!input.isTTY) throw new Error('Informe PAIRING_CODE no ambiente para execução não interativa')
  const rl = createInterface({ input, output })
  try { return await rl.question('Cole o código de pareamento temporário: ') }
  finally { rl.close() }
}

export async function enrollAgent({ pairingUrl, deviceId, code, outputFile, fetchImpl = fetch }) {
  validateDeviceId(deviceId)
  const url = new URL(pairingUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/v1/pair') {
    throw new Error('Use o endereço HTTPS completo, terminado em /v1/pair, sem credenciais')
  }
  const file = resolve(outputFile)
  // Exclusive create BEFORE making the request, so an existing identity can never be overwritten.
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const handle = await open(file, 'wx', 0o600)
  let committed = false
  try {
    const response = await fetchImpl(url, {
      method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({ deviceId, code }), signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error('O servidor recusou o pareamento')
    const content = await response.text()
    if (Buffer.byteLength(content, 'utf8') > 2048) throw new Error('Resposta de pareamento muito grande')
    const config = JSON.parse(content)
    if (config.deviceId !== deviceId || config.mqttUsername !== deviceId) throw new Error('Identidade não corresponde ao dispositivo')
    validateTransportEnv({ DEVICE_ID: deviceId, MQTT_URL: config.mqttUrl, MQTT_USERNAME: config.mqttUsername, MQTT_PASSWORD: config.mqttPassword }, 'agent')
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(config.mqttPassword)) throw new Error('Credencial MQTT inválida')
    const lines = [
      `DEVICE_ID=${deviceId}`, `MQTT_URL=${config.mqttUrl}`, `MQTT_USERNAME=${config.mqttUsername}`,
      `MQTT_PASSWORD=${config.mqttPassword}`, `PROJECTS_DIR=${join(homedir(), 'projects')}`,
      'REMOTE_ALLOW_WRITE=0', 'REMOTE_ALLOW_EXECUTE=0', 'REMOTE_TRUSTED_PROJECTS=', '',
    ]
    await handle.writeFile(lines.join('\n'))
    await handle.sync()
    committed = true
    return { deviceId, file }
  } finally {
    await handle.close()
    if (!committed) { const { rm } = await import('node:fs/promises'); await rm(file, { force: true }) }
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [, , pairingUrl, deviceId] = process.argv
  if (!pairingUrl || !deviceId || process.argv.length !== 4) {
    console.error('Uso: node remote/pair-agent.mjs https://pair.example.com/v1/pair meu-dispositivo')
    process.exitCode = 2
  } else {
    try {
      const code = await enterCode()
      const result = await enrollAgent({ pairingUrl, deviceId, code, outputFile: resolve('remote/.env.agent') })
      console.log(`Pareado: ${result.deviceId}. Configuração protegida em ${result.file}. Escrita e execução remotas estão DESLIGADAS.`)
    } catch (error) { console.error(error.message); process.exitCode = 1 }
  }
}
