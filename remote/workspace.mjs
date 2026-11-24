import { readdir, lstat, realpath, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { resolve, join, relative, sep, extname, dirname, isAbsolute } from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.py', '.rs', '.go', '.yml', '.yaml', '.sql', '.sh', '.txt', '.toml', '.scss', '.svg'])
const excluded = new Set(['node_modules', 'dist', 'build', 'coverage', 'vendor', 'secrets'])
const maxFileBytes = 160_000

function isWithin(root, path) {
  const rel = relative(root, path)
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)
}

function safeName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name) && name !== '..' && !excluded.has(name)
}

async function getProject(root, project) {
  if (!safeName(project)) throw new Error('Nome de projeto inválido')
  const parent = await realpath(root)
  const path = join(parent, project)
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Projeto não autorizado')
  const actual = await realpath(path)
  if (!isWithin(parent, actual)) throw new Error('Projeto fora da pasta autorizada')
  return actual
}

async function getFile(root, project, name, allowCreate = false) {
  if (typeof name !== 'string' || name.length > 512 || !name || name.includes('\\') || name.includes('\0') || name.startsWith('/')) throw new Error('Nome de arquivo inválido')
  const segments = name.split('/')
  if (segments.some(part => !safeName(part) || part.startsWith('.'))) throw new Error('Caminho protegido')
  if (!extensions.has(extname(name).toLowerCase())) throw new Error('Extensão não autorizada')
  const base = await getProject(root, project)
  const target = join(base, ...segments)
  if (!isWithin(base, target)) throw new Error('Caminho fora do projeto')
  const parent = await realpath(dirname(target))
  if (parent !== base && !isWithin(base, parent)) throw new Error('Diretório fora do projeto')
  try {
    const stat = await lstat(target)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxFileBytes) throw new Error('Arquivo protegido ou muito grande')
  } catch (error) { if (error.code !== 'ENOENT' || !allowCreate) throw error }
  return target
}

async function runCommand(projectPath, kind, maxDurationMs = 90_000) {
  const command = kind === 'git_status' ? 'git' : 'npm'
  const args = kind === 'git_status' ? ['status', '--short'] : kind === 'run_tests' ? ['test', '--silent'] : ['run', 'build', '--silent']
  return await new Promise(resolveResult => {
    const child = spawn(command, args, { cwd: projectPath, env: { ...process.env, CI: '1' }, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = '', done = false, timedOut = false
    const append = chunk => {
      if (output.length < 24_000) output += chunk.toString('utf8').slice(0, 24_000 - output.length)
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, maxDurationMs)
    const finish = (code, error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolveResult({ code: code ?? -1, timedOut, output: output.slice(0, 24_000), ...(error ? { error: String(error.message) } : {}) })
    }
    child.once('error', err => finish(-1, err))
    child.once('close', code => finish(code))
  })
}

export function createWorkspace({ root, allowWrite = false, allowExecute = false, trustedProjects = [], onAudit = () => {} }) {
  if (!root) throw new Error('Configure PROJECTS_DIR')
  const home = resolve(root)
  const trusted = new Set(trustedProjects.filter(safeName))
  const audit = (action, project, outcome) => onAudit({ at: new Date().toISOString(), action, project, outcome })
  return async function execute(method, args = {}) {
    const project = args?.project
    try {
      if (method === 'list_projects') {
        const dirs = await readdir(home, { withFileTypes: true })
        const projects = dirs.filter(x => x.isDirectory() && safeName(x.name) && !x.name.startsWith('.')).map(x => x.name).sort()
        audit(method, null, 'ok')
        return { projects }
      }
      if (method === 'read_file') {
        const file = await getFile(home, project, args.file)
        const content = await readFile(file, 'utf8')
        audit(method, project, 'ok')
        return { content }
      }
      if (method === 'write_file') {
        if (!allowWrite || !trusted.has(project)) throw new Error('Escrita não autorizada neste projeto')
        if (typeof args.content !== 'string' || Buffer.byteLength(args.content, 'utf8') > maxFileBytes) throw new Error('Conteúdo excede o limite permitido')
        const file = await getFile(home, project, args.file, true)
        const temp = join(dirname(file), `.studio-${randomUUID()}`)
        try {
          await writeFile(temp, args.content, { mode: 0o600, flag: 'wx' })
          await rename(temp, file)
        } finally { await rm(temp, { force: true }) }
        audit(method, project, 'ok')
        return { saved: true }
      }
      if (['run_tests', 'run_build', 'git_status'].includes(method)) {
        if (!allowExecute || !trusted.has(project)) throw new Error('Execução não autorizada neste projeto')
        const path = await getProject(home, project)
        const result = await runCommand(path, method)
        audit(method, project, result.code === 0 ? 'ok' : 'failed')
        return result
      }
      throw new Error('Ferramenta desconhecida')
    } catch (error) {
      audit(method, typeof project === 'string' ? project : null, 'denied')
      throw error
    }
  }
}
