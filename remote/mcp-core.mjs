import { METHODS } from './protocol.mjs'

const string = { type: 'string' }
const toolSpecs = [
  ['list_projects', 'Lista os projetos autorizados do dispositivo.', {}],
  ['read_file', 'Lê arquivo de código dentro de um projeto.', { project: string, file: string }],
  ['write_file', 'Grava código em projeto autorizado. Precisa habilitar escrita no agente.', { project: string, file: string, content: string }],
  ['run_tests', 'Executa npm test no projeto confiável autorizado.', { project: string }],
  ['run_build', 'Executa npm run build no projeto confiável autorizado.', { project: string }],
  ['git_status', 'Obtém git status --short no projeto.', { project: string }],
]
export const tools = toolSpecs.map(([name, description, properties]) => ({
  name,
  description,
  inputSchema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
}))

export async function dispatchMcp(request, rpc) {
  if (!request || typeof request !== 'object' || request.jsonrpc !== '2.0') return { error: { code: -32600, message: 'JSON-RPC inválido' } }
  switch (request.method) {
    case 'initialize':
      return { result: { protocolVersion: '2025-11-25', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'termux-studio-remote', version: '0.3.0' } } }
    case 'ping': return { result: {} }
    case 'tools/list': return { result: { tools } }
    case 'tools/call': {
      const name = request.params?.name
      if (!METHODS.includes(name)) return { result: { isError: true, content: [{ type: 'text', text: 'Ferramenta não autorizada' }] } }
      const args = request.params?.arguments || {}
      if (Object.keys(args).some(key => !Object.hasOwn(tools.find(t => t.name === name).inputSchema.properties, key))) {
        return { result: { isError: true, content: [{ type: 'text', text: 'Argumento não permitido' }] } }
      }
      const required = tools.find(t => t.name === name).inputSchema.required
      if (required.some(k => typeof args[k] !== 'string')) return { result: { isError: true, content: [{ type: 'text', text: 'Parâmetro obrigatório inválido' }] } }
      try {
        const answer = await rpc.call(name, args)
        return { result: { content: [{ type: 'text', text: JSON.stringify(answer) }] } }
      } catch (error) {
        return { result: { isError: true, content: [{ type: 'text', text: String(error.message).slice(0, 250) }] } }
      }
    }
    default: return { error: { code: -32601, message: 'Método não encontrado' } }
  }
}
