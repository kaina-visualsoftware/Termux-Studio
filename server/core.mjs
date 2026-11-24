import { readdir } from 'node:fs/promises'
import { resolve, relative, sep, basename } from 'node:path'

const LOCAL_HEALTH_URL = 'http://127.0.0.1:8080/healthz'

/** Only folders directly below the configured projects root are listed. */
export async function listProjects(root, max = 80) {
  const absolute = resolve(root)
  let entries
  try {
    entries = await readdir(absolute, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, max)
    .map(entry => ({
      name: entry.name,
      path: resolve(absolute, entry.name),
      id: entry.name,
    }))
}

/** Safe static-path resolution, with no parent traversal. */
export function staticPath(root, requestedPath) {
  if (requestedPath.includes('\\') || requestedPath.includes('\0')) return null
  let decoded
  try { decoded = decodeURIComponent(requestedPath) } catch { return null }
  if (decoded.includes('\0') || decoded.includes('\\')) return null
  const absolute = resolve(root)
  const full = resolve(absolute, '.' + decoded)
  const rel = relative(absolute, full)
  if (rel === '..' || rel.startsWith('..' + sep) || rel.startsWith(sep)) return null
  return full
}

export function normalizeEditorUrl(raw) {
  const parsed = new URL(raw)
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Protocolo inválido')
  if (parsed.username || parsed.password) throw new Error('Credenciais não são permitidas na URL')
  if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Use HTTPS fora do localhost')
  }
  return parsed.toString().replace(/\/$/, '')
}

export function getSettings(env) {
  const projectsRoot = resolve(env.PROJECTS_DIR || `${env.HOME || '/tmp'}/projects`)
  let editorUrl = 'http://127.0.0.1:8080'
  try { editorUrl = normalizeEditorUrl(env.EDITOR_PUBLIC_URL || editorUrl) } catch { /* safe fallback */ }
  return { projectsRoot, editorUrl, healthUrl: LOCAL_HEALTH_URL }
}

export function formatName(name) {
  return basename(name).replace(/[-_]/g, ' ')
}
