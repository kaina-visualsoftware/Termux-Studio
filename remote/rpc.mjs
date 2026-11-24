import { makeRequest, decodeMessage, topics, MAX_MESSAGE_BYTES } from './protocol.mjs'

// Correlates idempotent MQTT responses. No monthly quota or credit counter.
export class RpcOverMqtt {
  constructor(mqttClient, deviceId, { timeoutMs = 30_000, maxInFlight = 4 } = {}) {
    this.client = mqttClient
    this.device = deviceId
    this.channel = topics(deviceId)
    this.timeoutMs = timeoutMs
    this.maxInFlight = maxInFlight
    this.pending = new Map()
    this.client.on('message', (topic, payload) => this.onMessage(topic, payload))
    this.client.on('close', () => this.failAll('Conexão MQTT indisponível'))
  }

  onMessage(topic, payload) {
    if (topic !== this.channel.response) return
    let data
    try { data = decodeMessage(payload) } catch { return }
    if (data.device !== this.device) return
    const pending = this.pending.get(data.id)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(data.id)
    if (data.ok === true) pending.resolve(data.result)
    else pending.reject(new Error(typeof data.error === 'string' ? data.error.slice(0, 250) : 'Erro remoto'))
  }

  failAll(reason) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason))
      this.pending.delete(id)
    }
  }

  call(method, args = {}) {
    if (!this.client.connected) return Promise.reject(new Error('Broker MQTT offline'))
    if (this.pending.size >= this.maxInFlight) return Promise.reject(new Error('Muitas operações simultâneas'))
    const request = makeRequest(this.device, method, args)
    const payload = JSON.stringify(request)
    if (Buffer.byteLength(payload) > MAX_MESSAGE_BYTES) return Promise.reject(new Error('Solicitação muito grande'))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.id)
        reject(new Error('Tempo de resposta excedido'))
      }, this.timeoutMs)
      this.pending.set(request.id, { resolve, reject, timer })
      this.client.publish(this.channel.request, payload, { qos: 1, retain: false }, error => {
        if (!error) return
        const pending = this.pending.get(request.id)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pending.delete(request.id)
        reject(error)
      })
    })
  }
}
