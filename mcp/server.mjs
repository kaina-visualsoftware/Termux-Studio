import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { lstat, realpath, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { resolve, join, dirname, extname, relative, isAbsolute } from 'node:path'
import { listProjects } from '../server/core.mjs'

// Agente MCP estritamente LOCAL (stdio). Não existe endpoint HTTP neste módulo.
const projectRoot = resolve(process.env.PROJECTS_DIR || join(homedir(), 'projects'))
const canWrite = process.env.TERMUX_STUDIO_MCP_WRITE === '1'
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.py', '.rs', '.go', '.yml', '.yaml', '.sql', '.sh', '.txt', '.toml', '.scss', '.svg'])
const schema = { type: 'object', additionalProperties: false }
const tools = [
  { name: 'list_projects', description: 'Lista nomes de pastas de projetos disponíveis (sem caminhos ocultos).', inputSchema: { ...schema, properties: {} } },
  { name: 'read_project_file', description: 'Lê arquivo de código de um projeto autorizado. Não lê .env, segredos ou arquivos ocultos.', inputSchema: { ...schema, properties: { project: { type: 'string' }, file: { type: 'string' } }, required: ['project', 'file'] } },
  ...(canWrite ? [{ name: 'write_project_file', description: 'Altera um arquivo de código autorizado. A gravação precisa estar habilitada no processo pelo dono do dispositivo.', inputSchema: { ...schema, properties: { project: { type: 'string' }, file: { type: 'string' }, content: { type: 'string' } }, required: ['project', 'file', 'content'] } }] : []),
]

function inside(base, target) {
  const rel = relative(base, target)
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + '/') && !rel.startsWith('..' + '\\') && !isAbsolute(rel)
}
async function projectFile(project, file, allowCreate) {
  if (typeof project !== 'string' || !project || project.startsWith('.') || project.includes('/') || project.includes('\\') || project.includes('\0') || project === '..') throw Error('Projeto inválido')
  if (typeof file !== 'string' || file.length > 512 || !file || file.startsWith('/') || file.includes('\\') || file.includes('\0')) throw Error('Caminho inválido')
  const segments = file.split('/')
  if (segments.some(segment => !segment || segment.startsWith('.') || ['node_modules', 'dist', 'build', 'coverage', 'vendor', 'secrets'].includes(segment))) throw Error('Caminho protegido')
  if (!extensions.has(extname(file).toLowerCase())) throw Error('Somente arquivos de código e texto permitidos')
  const realRoot = await realpath(projectRoot)
  const base = join(realRoot, project)
  const baseInfo = await lstat(base)
  if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink()) throw Error('Projeto não autorizado')
  const target = join(base, ...segments)
  if (!inside(base, target)) throw Error('Caminho fora do projeto')
  const parent = await realpath(dirname(target))
  if (parent !== base && !inside(base, parent)) throw Error('Diretório externo não permitido')
  try {
    const info = await lstat(target)
    if (!info.isFile() || info.isSymbolicLink()) throw Error('Arquivo protegido')
    if (info.size > 200_000) throw Error('Arquivo muito grande')
  } catch (error) {
    if (!allowCreate || error.code !== 'ENOENT') throw error
  }
  return target
}
function result(text, isError = false) { return { content: [{ type: 'text', text: String(text) }], ...(isError ? { isError: true } : {}) } }
async function call(name, args) {
  try {
    if (name === 'list_projects') return result(JSON.stringify((await listProjects(projectRoot)).map(p => ({ name: p.name }))))
    if (name === 'read_project_file') {
      const filename = await projectFile(args?.project, args?.file, false)
      return result(await readFile(filename, 'utf8'))
    }
    if (name === 'write_project_file' && canWrite) {
      if (typeof args?.content !== 'string' || Buffer.byteLength(args.content, 'utf8') > 200_000) throw Error('Conteúdo inválido ou muito grande')
      const filename = await projectFile(args.project, args.file, true)
      const temp = join(dirname(filename), '.termux-studio-' + randomUUID())
      try {
        await writeFile(temp, args.content, { flag: 'wx', mode: 0o600 })
        await rename(temp, filename)
      } finally { await rm(temp, { force: true }) }
      return result('Arquivo salvo no projeto permitido.')
    }
    throw Error('Ferramenta indisponível')
  } catch (error) { return result(error.message || 'Falha no acesso ao arquivo', true) }
}
function send(message) { process.stdout.write(JSON.stringify(message) + '\n') }
const reader = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of reader) {
  if (!line || line.length > 400_000) continue
  let request
  try { request = JSON.parse(line) } catch { continue }
  if (!Object.hasOwn(request, 'id')) continue // notificação, sem resposta
  try {
    let response
    switch (request.method) {
      case 'initialize':
        response = {
          protocolVersion: ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'].includes(request.params?.protocolVersion) ? request.params.protocolVersion : '2025-11-25',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'termux-studio-local', version: '0.2.0' },
        }
        break
      case 'ping': response = {}; break
      case 'tools/list': response = { tools }; break
      case 'tools/call': response = await call(request.params?.name, request.params?.arguments || {}); break
      default:
        send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Método não encontrado' } })
        continue
    }
    send({ jsonrpc: '2.0', id: request.id, result: response })
  } catch { send({ jsonrpc: '2.0', id: request.id, error: { code: -32603, message: 'Falha interna' } }) }
}
