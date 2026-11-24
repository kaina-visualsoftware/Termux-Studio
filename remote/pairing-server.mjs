import { createServer } from 'node:http'
import { redeemPairing, pairingKey } from './pairing-core.mjs'

// Bind only on loopback. HTTPS must be terminated by an authenticated reverse proxy.
export function createPairingServer({ directory, key, logger = () => {} }) {
  pairingKey(key)
  if (!directory) throw new Error('PAIRING_DIR é obrigatório')
  const server = createServer(async (req, res) => {
    const respond = (status, payload) => {
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
      })
      res.end(JSON.stringify(payload))
    }
    if (req.url !== '/v1/pair' || req.method !== 'POST') return respond(404, { error: 'Não encontrado' })
    if (req.headers.origin) return respond(403, { error: 'Requisição de navegador não permitida' })
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return respond(415, { error: 'Use JSON' })
    try {
      let raw = '', size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 4096) return respond(413, { error: 'Payload muito grande' })
        raw += chunk.toString('utf8')
      }
      const data = JSON.parse(raw)
      if (Array.isArray(data) || !data || typeof data !== 'object' || Object.keys(data).some(k => !['deviceId','code'].includes(k))) {
        return respond(400, { error: 'Solicitação inválida' })
      }
      const credentials = await redeemPairing({ directory, key, deviceId: data.deviceId, code: data.code })
      logger({ type: 'pair', outcome: 'ok', deviceId: data.deviceId })
      return respond(200, credentials)
    } catch {
      // Do not disclose device IDs, code checks, passwords or filenames to clients.
      logger({ type: 'pair', outcome: 'denied' })
      return respond(403, { error: 'Código inválido ou expirado' })
    }
  })
  return server
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const port = Number(process.env.PAIRING_PORT || 8790)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PAIRING_PORT inválida')
  const server = createPairingServer({
    directory: process.env.PAIRING_DIR,
    key: process.env.PAIRING_MASTER_KEY,
    logger: (entry) => console.error(JSON.stringify(entry)),
  })
  server.listen(port, '127.0.0.1', () => console.error(`Pareamento em 127.0.0.1:${port}; HTTPS obrigatório no proxy`))
}
