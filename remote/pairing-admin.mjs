import { issuePairing } from './pairing-core.mjs'

const [, , cmd, deviceId] = process.argv
if (cmd !== 'issue' || !deviceId || process.argv.length !== 4) {
  console.error('Uso: PAIRING_MASTER_KEY=... PAIRING_MQTT_PASSWORD=... PAIRING_MQTT_URL=mqtts://... node remote/pairing-admin.mjs issue ID_DO_DISPOSITIVO')
  process.exitCode = 2
} else {
  try {
    const pairing = await issuePairing({
      directory: process.env.PAIRING_DIR,
      key: process.env.PAIRING_MASTER_KEY,
      deviceId,
      mqttUrl: process.env.PAIRING_MQTT_URL,
      mqttPassword: process.env.PAIRING_MQTT_PASSWORD,
    })
    console.log(`Dispositivo: ${pairing.deviceId}\nExpira: ${pairing.expiresAt}\nCódigo de uso único: ${pairing.code}\nNão cole o código em issues públicas ou logs.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
