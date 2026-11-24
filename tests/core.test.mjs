import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listProjects, staticPath, normalizeEditorUrl, getSettings, formatName } from '../server/core.mjs'

test('lista somente diretórios visíveis e ordenados', async () => {
  const root = await mkdtemp(join(tmpdir(), 'termux-studio-'))
  try {
    await mkdir(join(root, 'zeta'))
    await mkdir(join(root, 'alpha'))
    await mkdir(join(root, '.secrets'))
    await symlink(tmpdir(), join(root, 'linked'))
    const result = await listProjects(root)
    assert.deepEqual(result.map(p => p.name), ['alpha', 'zeta'])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('diretório inexistente retorna lista vazia', async () => {
  assert.deepEqual(await listProjects(join(tmpdir(), 'does-not-exist-ux-xyz')), [])
})

test('limite de projetos é respeitado', async () => {
  const root = await mkdtemp(join(tmpdir(), 'termux-studio-'))
  try {
    await Promise.all(['a', 'b', 'c'].map(x => mkdir(join(root, x))))
    assert.equal((await listProjects(root, 2)).length, 2)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('caminhos normais são resolvidos em dist', () => {
  assert.equal(staticPath('/tmp/studio', '/assets/a.js'), '/tmp/studio/assets/a.js')
})

test('nega traversal com barras invertidas e byte nulo', () => {
  assert.equal(staticPath('/tmp/studio', '/a\\b'), null)
  assert.equal(staticPath('/tmp/studio', '/a%00b'), null)
  assert.equal(staticPath('/tmp/studio', '/a%5Cb'), null)
})

test('nega path traversal usando componentes ..', () => {
  assert.equal(staticPath('/tmp/studio', '/../../etc/passwd'), null)
})

test('aceita URL HTTPS do editor', () => {
  assert.equal(normalizeEditorUrl('https://ide.example.com/'), 'https://ide.example.com')
})

test('aceita localhost HTTP', () => {
  assert.equal(normalizeEditorUrl('http://127.0.0.1:8080'), 'http://127.0.0.1:8080')
})

test('nega HTTP remoto sem criptografia', () => {
  assert.throws(() => normalizeEditorUrl('http://example.com:8080'))
})

test('nega URLs com usuário e senha e protocolos indevidos', () => {
  assert.throws(() => normalizeEditorUrl('https://admin:123@example.com'))
  assert.throws(() => normalizeEditorUrl('javascript:alert(1)'))
})

test('configuração usa projetos e editor declarados', () => {
  const v = getSettings({ HOME: '/tmp/user', EDITOR_PUBLIC_URL: 'https://ide.example.com', PROJECTS_DIR: '/tmp/work' })
  assert.equal(v.projectsRoot, '/tmp/work')
  assert.equal(v.editorUrl, 'https://ide.example.com')
  assert.equal(v.healthUrl, 'http://127.0.0.1:8080/healthz')
})

test('normaliza nomes de diretórios', () => {
  assert.equal(formatName('meu-projeto_react'), 'meu projeto react')
})
