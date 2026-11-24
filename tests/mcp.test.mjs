import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const command = new URL('../mcp/server.mjs', import.meta.url).pathname
const request = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params })
async function session(root, messages, write = false) {
  const child = spawn(process.execPath, [command], {
    env: { ...process.env, PROJECTS_DIR: root, TERMUX_STUDIO_MCP_WRITE: write ? '1' : '0' }, stdio: ['pipe', 'pipe', 'pipe'],
  })
  let output = ''
  let stderr = ''
  child.stdout.on('data', b => { output += b.toString() })
  child.stderr.on('data', b => { stderr += b.toString() })
  child.stdin.end(messages.map(m => JSON.stringify(m)).join('\n') + '\n')
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve) })
  assert.equal(code, 0, stderr)
  return output.trim().split('\n').map(s => JSON.parse(s))
}
test('MCP local lista projetos e bloqueia escrita sem permissão', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-mcp-'))
  try {
    await mkdir(join(root, 'app'))
    await writeFile(join(root, 'app', 'main.ts'), 'const x = 1\n')
    const result = await session(root, [
      request(1, 'initialize', { protocolVersion: '2025-11-25' }),
      request(2, 'tools/list'),
      request(3, 'tools/call', { name: 'list_projects', arguments: {} }),
      request(4, 'tools/call', { name: 'read_project_file', arguments: { project: 'app', file: 'main.ts' } }),
      request(5, 'tools/call', { name: 'write_project_file', arguments: { project: 'app', file: 'main.ts', content: 'bad' } }),
    ])
    assert.equal(result.length, 5)
    assert.equal(result[0].result.protocolVersion, '2025-11-25')
    assert.equal(result[1].result.tools.some(t => t.name === 'write_project_file'), false)
    assert.match(result[2].result.content[0].text, /app/)
    assert.equal(result[3].result.content[0].text, 'const x = 1\n')
    assert.equal(result[4].result.isError, true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('MCP com escrita habilitada só edita código no projeto permitido', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-mcp-'))
  try {
    await mkdir(join(root, 'app'))
    await writeFile(join(root, 'app', '.env'), 'SECRET=private')
    const result = await session(root, [
      request(1, 'tools/call', { name: 'write_project_file', arguments: { project: 'app', file: 'main.ts', content: 'export const x = 2' } }),
      request(2, 'tools/call', { name: 'read_project_file', arguments: { project: 'app', file: '../.env' } }),
      request(3, 'tools/call', { name: 'read_project_file', arguments: { project: 'app', file: '.env' } }),
      request(4, 'tools/call', { name: 'write_project_file', arguments: { project: '..', file: 'file.ts', content: 'bad' } }),
    ], true)
    assert.equal((await readFile(join(root, 'app', 'main.ts'), 'utf8')), 'export const x = 2')
    assert.equal(result[0].result.isError, undefined)
    assert.equal(result[1].result.isError, true)
    assert.equal(result[2].result.isError, true)
    assert.equal(result[3].result.isError, true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
