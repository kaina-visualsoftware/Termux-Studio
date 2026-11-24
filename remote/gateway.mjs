import mqtt from 'mqtt'
import { createServer } from 'node:http'
import { validateTransportEnv, matchesBearer, topics } from './protocol.mjs'
import { RpcOverMqtt } from './rpc.mjs'
import { dispatchMcp } from './mcp-core.mjs'

const env = process.env
const brokerUrl = validateTransportEnv(env, 'gateway')
const device = env.DEVICE_ID
const channel = topics(device)
const bindAddress = '127.0.0.1' // Exponha SOMENTE via proxy HTTPS com autenticação adicional
const port = Number(env.REMOTE_GATEWAY_PORT || 8787)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta inválida')

const mqttClient = mqtt.connect(brokerUrl, {
  username: env.MQTT_USERNAME,
  password: env.MQTT_PASSWORD,
  clientId: `ts-gateway-${device}`,
  rejectUnauthorized: true,
  clean: true,
  reconnectPeriod: 3000,
  connectTimeout: 12_000,
  keepalive: 30,
  queueQoSZero: false,
})
const rpc = new RpcOverMqtt(mqttClient, device)
mqttClient.on('connect', () => mqttClient.subscribe(channel.response, { qos: 1 }, error => {
  if (error) console.error('Assinatura de respostas falhou:', error.message)
}))
mqttClient.on('error', error => console.error('MQTT:', error.message))

function reply(res, status, body) {
  const content = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
  })
  res.end(content)
}
const server = createServer(async (req, res) => {
  if (req.url !== '/mcp' || req.method !== 'POST') return reply(res, 404, { error: 'Rota indisponível' })
  // Browser-origin requests are disallowed; remote MCP clients must be server-side.
  if (req.headers.origin) return reply(res, 403, { error: 'Origin não autorizado' })
  if (!matchesBearer(req.headers.authorization, env.REMOTE_MCP_TOKEN)) return reply(res, 401, { error: 'Não autorizado' })
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return reply(res, 415, { error: 'Use application/json' })
  let body = ''
  try {
    for await (const chunk of req) {
      body += chunk
      if (Buffer.byteLength(body) > 64_000) return reply(res, 413, { error: 'Mensagem muito grande' })
    }
    const request = JSON.parse(body)
    if (Array.isArray(request)) return reply(res, 400, { error: 'Lotes JSON-RPC não suportados' })
    if (request.method === 'notifications/initialized') return res.writeHead(202).end()
    const result = await dispatchMcp(request, rpc)
    return reply(res, 200, { jsonrpc: '2.0', id: request.id ?? null, ...result })
  } catch {
    return reply(res, 400, { error: 'Solicitação inválida' })
  }
})
server.listen(port, bindAddress, () => console.error(`Gateway MCP local em http://${bindAddress}:${port}/mcp`))
process.on('SIGINT', () => { rpc.failAll('Encerrando'); mqttClient.end(true); server.close() })
process.on('SIGTERM', () => { rpc.failAll('Encerrando'); mqttClient.end(true); server.close() })
