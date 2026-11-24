import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, Braces, Check, ChevronDown,
  ChevronRight, CircleHelp, Clock3, Code2, Cpu, ExternalLink, Files,
  Folder, FolderClosed, FolderGit2, Github, Globe2, HardDrive, Laptop2,
  LayoutDashboard, Menu, Monitor, MoreHorizontal, RefreshCw, Search, Server,
  Settings2, ShieldCheck, Smartphone, Terminal, Wifi, X, Zap,
} from 'lucide-react'

type Page = 'overview' | 'projects' | 'settings'
type Project = { id: string; name: string; path: string }
type Dashboard = {
  projects: Project[]
  editor: { url: string; online: boolean }
  device: { platform: string; arch: string; hostname: string; uptimeSeconds: number; totalMemory: number; freeMemory: number }
  checkedAt: string
}

const viewNames: Record<Page, string> = {
  overview: 'Visão geral',
  projects: 'Meus projetos',
  settings: 'Configurações',
}

const navItems: { key: Page; title: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', title: 'Visão geral', icon: LayoutDashboard },
  { key: 'projects', title: 'Projetos', icon: FolderGit2 },
  { key: 'settings', title: 'Configurações', icon: Settings2 },
]

function formatMemory(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) return '—'
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatUptime(sec?: number) {
  if (sec === undefined) return '—'
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

function validateEditorUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.username || url.password) return false
    if (url.protocol === 'https:') return true
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch { return false }
}

function IconProject({ name }: { name: string }) {
  const lowercase = name.toLowerCase()
  if (lowercase.includes('react') || lowercase.includes('web') || lowercase.includes('front')) {
    return <span className="project-mark mark-purple"><Braces size={21} /></span>
  }
  if (lowercase.includes('api') || lowercase.includes('back') || lowercase.includes('server')) {
    return <span className="project-mark mark-cyan"><Server size={20} /></span>
  }
  if (lowercase.includes('mobile') || lowercase.includes('app')) {
    return <span className="project-mark mark-orange"><Smartphone size={20} /></span>
  }
  return <span className="project-mark mark-blue"><Folder size={21} /></span>
}

function ProjectCard({ project, onOpen, index }: { project: Project; onOpen: (project: Project) => void; index: number }) {
  return (
    <article className="project-card">
      <div className="project-topline"><IconProject name={project.name} /><button className="icon-button ghost small" title="Abrir projeto no editor" onClick={() => onOpen(project)} aria-label={`Abrir ${project.name}`}><ArrowUpRight size={18} /></button></div>
      <h3>{project.name}</h3>
      <p className="project-path" title={project.path}>{project.path}</p>
      <div className="project-bottom"><span><span className="folder-dot" /> Projeto #{String(index + 1).padStart(2, '0')}</span><button className="text-link" onClick={() => onOpen(project)}>Abrir editor <ArrowRight size={15} /></button></div>
    </article>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('overview')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [customEditorUrl, setCustomEditorUrl] = useState(() => { try { return localStorage.getItem('termux-studio-editor-url') || '' } catch { return '' } })
  const [urlDraft, setUrlDraft] = useState(customEditorUrl)

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = (await response.json()) as Dashboard
      setData(result)
      setError('')
    } catch {
      setError('Não foi possível conectar ao painel do Termux. Verifique se o serviço está em execução.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30000)
    return () => window.clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const publicEditorUrl = customEditorUrl || data?.editor.url || 'http://127.0.0.1:8080'
  const filteredProjects = useMemo(() => (data?.projects || []).filter(project => `${project.name} ${project.path}`.toLowerCase().includes(search.trim().toLowerCase())), [data, search])

  function openEditor(project?: Project) {
    if (!data?.editor.online) {
      setToast('O code-server está offline. Inicie o serviço no Debian para abrir o editor.')
      return
    }
    if (!validateEditorUrl(publicEditorUrl)) {
      setPage('settings')
      setToast('Informe um endereço HTTPS válido para o editor.')
      return
    }
    const url = new URL(publicEditorUrl)
    const currentHost = window.location.hostname
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !['localhost', '127.0.0.1', '[::1]'].includes(currentHost)) {
      setPage('settings')
      setToast('Configure a URL pública HTTPS do editor para acessar de outro dispositivo.')
      return
    }
    if (project) url.searchParams.set('folder', project.path)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  function saveEditorUrl() {
    const normalized = urlDraft.trim()
    if (normalized && !validateEditorUrl(normalized)) {
      setToast('Use HTTPS ou http://127.0.0.1 em acesso local.')
      return
    }
    try {
      if (normalized) localStorage.setItem('termux-studio-editor-url', normalized)
      else localStorage.removeItem('termux-studio-editor-url')
    } catch { setToast('O navegador não permitiu salvar essa preferência.'); return }
    setCustomEditorUrl(normalized)
    setToast(normalized ? 'Endereço do editor salvo neste navegador.' : 'Endereço restaurado para a configuração do servidor.')
  }

  const connected = !error && !!data
  const onlineEditor = connected && data?.editor.online
  const memoryPercent = data ? Math.round((1 - data.device.freeMemory / Math.max(data.device.totalMemory, 1)) * 100) : 0
  const visibleProjects = page === 'overview' ? filteredProjects.slice(0, 6) : filteredProjects

  return (
    <div className="app-shell">
      <div className={`mobile-shade ${drawerOpen ? 'shown' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Code2 size={22} strokeWidth={2.6} /></span><span className="brand-copy"><b>Termux<span>Studio</span></b><small>REMOTE WORKSPACE</small></span><button className="mobile-close icon-button" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)}><X size={19} /></button></div>
        <div className="side-section-title">WORKSPACE</div>
        <nav className="nav-list" aria-label="Navegação principal">
          {navItems.map(item => { const Icon = item.icon; return <button key={item.key} className={`nav-item ${page === item.key ? 'active' : ''}`} onClick={() => { setPage(item.key); setDrawerOpen(false) }}><Icon size={19} /> {item.title} {page === item.key && <span className="nav-active-line" />}</button> })}
        </nav>
        <div className="sidebar-divider" />
        <div className="side-section-title">ACESSO RÁPIDO</div>
        <button className="nav-item" onClick={() => openEditor()}><Code2 size={19} /> VS Code Online <ExternalLink size={14} className="nav-trailing" /></button>
        <button className="nav-item" onClick={() => { setToast('Abra o VS Code Online e use Terminal → Novo Terminal.'); setDrawerOpen(false) }}><Terminal size={19} /> Terminal integrado <ArrowUpRight size={14} className="nav-trailing" /></button>
        <div className="sidebar-bottom">
          <div className="connection-card"><div className="connection-caption"><span className={`status-led ${connected ? 'live' : ''}`} /> {connected ? 'Termux conectado' : 'Termux indisponível'}</div><p>{connected ? 'Painel respondendo normalmente' : 'Confira o serviço no Debian'}</p><div className="connection-info"><Smartphone size={15} /> Android · Linux ARM64</div></div>
          <div className="side-footer"><div className="avatar">TS</div><div><strong>Meu workspace</strong><span>Ambiente pessoal</span></div><MoreHorizontal size={19} /></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="top-left"><button className="icon-button menu-button" aria-label="Abrir menu" onClick={() => setDrawerOpen(true)}><Menu size={21} /></button><span className="breadcrumb">Workspace</span><ChevronRight size={15} className="muted" /><span className="breadcrumb-current">{viewNames[page]}</span></div>
          <div className="top-right"><span className="top-environment"><span className={`status-led ${onlineEditor ? 'live' : ''}`} /> {onlineEditor ? 'Editor online' : 'Editor offline'}</span><button className="icon-button refresh-button" aria-label="Atualizar dados" title="Atualizar dados" onClick={() => void refresh(true)} disabled={refreshing}><RefreshCw size={18} className={refreshing ? 'spinning' : ''} /></button><span className="top-avatar">TS</span></div>
        </header>

        <div className="page-container">
          {page === 'overview' && <>
            <div className="page-intro"><div><span className="eyebrow">SEU AMBIENTE DE DESENVOLVIMENTO</span><h1>Bom dia, dev <span className="wave-dot">.</span></h1><p>Seus projetos, seu terminal e seu editor. Acesse tudo de qualquer lugar.</p></div><span className="date-chip"><Clock3 size={16} /> Atualização automática</span></div>
            <section className="hero"><div className="hero-grid" /><div className="hero-content"><span className="hero-label"><Zap size={14} /> SEU IDE, EM QUALQUER LUGAR</span><h2>Seu VS Code.<br /><span>Sem depender de um PC.</span></h2><p>Escreva código e execute projetos diretamente no Debian do seu Android, pelo navegador.</p><div className="hero-actions"><button className="primary-btn" onClick={() => openEditor()}><Code2 size={18} /> Abrir VS Code <ArrowUpRight size={18} /></button><button className="secondary-btn" onClick={() => setPage('projects')}>Ver projetos <ArrowRight size={17} /></button></div></div><div className="hero-art" aria-hidden="true"><div className="mock-window"><div className="mock-window-top"><div className="traffic"><i /><i /><i /></div><span>app.tsx — termux-studio</span><span>⌘</span></div><div className="mock-editor"><div className="mock-numbers">01<br />02<br />03<br />04<br />05<br />06<br />07</div><div className="mock-code"><span><em>import</em> {'{'} <b>useState</b> {'}'} <em>from</em> <q>'react'</q></span><span>&nbsp;</span><span><em>function</em> <b>App</b>() {'{'}</span><span>&nbsp;&nbsp;<em>return</em> (</span><span>&nbsp;&nbsp;&nbsp;&nbsp;&lt;<b>Workspace</b></span><span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="code-attr">online</span>={'{'}<q>true</q>{'}'}</span><span>&nbsp;&nbsp;&nbsp;&nbsp;/&gt; );</span></div></div><div className="mock-status"><span>● main</span><span>TypeScript</span></div></div></div></section>
            {error && <div className="error-banner"><CircleHelp size={19} /><span>{error}</span><button onClick={() => void refresh(true)}>Tentar novamente</button></div>}
            <section className="stats-grid" aria-label="Status do ambiente"><div className="stat-card"><span className="stat-icon icon-indigo"><FolderClosed size={22} /></span><span className="stat-label">Projetos disponíveis</span><div className="stat-value">{loading ? '…' : data?.projects.length ?? '—'} <span className="stat-hint">diretórios</span></div><div className="stat-foot">Na pasta de projetos do Debian</div></div><div className="stat-card"><span className="stat-icon icon-green"><Activity size={22} /></span><span className="stat-label">Status do editor</span><div className="stat-value stat-word">{onlineEditor ? 'Online' : 'Offline'} <span className={`status-led ${onlineEditor ? 'live' : ''}`} /></div><div className="stat-foot">code-server em porta local 8080</div></div><div className="stat-card"><span className="stat-icon icon-cyan"><Cpu size={22} /></span><span className="stat-label">Arquitetura</span><div className="stat-value stat-word">{data?.device.arch || '—'}</div><div className="stat-foot">{data?.device.platform || 'Linux'} · servidor Node.js</div></div><div className="stat-card"><span className="stat-icon icon-orange"><Clock3 size={22} /></span><span className="stat-label">Dispositivo ativo há</span><div className="stat-value">{formatUptime(data?.device.uptimeSeconds)}</div><div className="stat-foot">Tempo ligado do sistema</div></div></section>
          </>}

          {(page === 'overview' || page === 'projects') && <section className="projects-section"><div className="section-heading"><div><span className="eyebrow">WORKSPACE</span><h2>{page === 'overview' ? 'Seus projetos' : 'Explorar projetos'}</h2><p>Abra suas pastas diretamente no editor online.</p></div><div className="section-actions"><label className="search-box"><Search size={17} /><input type="search" aria-label="Buscar projetos" placeholder="Buscar projeto..." value={search} onChange={event => setSearch(event.target.value)} /></label>{page === 'overview' && <button className="outline-btn" onClick={() => setPage('projects')}>Ver todos <ArrowRight size={16} /></button>}</div></div>
            {loading ? <div className="empty-state"><RefreshCw className="spinning" size={24} /><h3>Carregando projetos</h3></div> : filteredProjects.length === 0 ? <div className="empty-state"><FolderClosed size={28} /><h3>{search ? 'Nenhum projeto encontrado' : 'Nenhum projeto disponível'}</h3><p>{search ? 'Tente outra busca.' : 'Crie ou clone um repositório dentro da pasta PROJECTS_DIR do Debian.'}</p></div> : <div className="projects-grid">{visibleProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={openEditor} />)}</div>}
          </section>}

          {page === 'overview' && <section className="lower-grid"><div className="info-panel"><div className="info-panel-header"><div className="info-badge"><Server size={19} /></div><div><h3>Ambiente de execução</h3><p>Dados do dispositivo onde o painel está rodando</p></div></div><div className="detail-row"><span><Laptop2 size={17} /> Host</span><strong>{data?.device.hostname || '—'}</strong></div><div className="detail-row"><span><HardDrive size={17} /> Memória disponível</span><strong>{formatMemory(data?.device.freeMemory)} / {formatMemory(data?.device.totalMemory)}</strong></div><div className="memory-progress"><div style={{ width: `${Math.min(100, Math.max(0, memoryPercent))}%` }} /></div><div className="detail-row"><span><Wifi size={17} /> Conexão com painel</span><strong className={connected ? 'good-text' : 'bad-text'}>{connected ? 'Ativa' : 'Sem conexão'}</strong></div></div><div className="help-panel"><span className="help-icon"><ShieldCheck size={24} /></span><h3>Acesse com segurança</h3><p>Configure um túnel HTTPS com autenticação para abrir seu workspace fora da rede local.</p><button className="text-link" onClick={() => setPage('settings')}>Como configurar <ArrowRight size={16} /></button><div className="shield-decoration"><ShieldCheck size={110} /></div></div></section>}

          {page === 'settings' && <><div className="page-intro settings-intro"><div><span className="eyebrow">WORKSPACE</span><h1>Configurações</h1><p>Personalize o acesso ao editor e confira as recomendações de segurança.</p></div></div><div className="settings-grid"><section className="settings-panel"><div className="settings-heading"><span className="info-badge"><Globe2 size={20} /></span><div><h2>Endereço público do editor</h2><p>URL utilizada para abrir seu VS Code Online.</p></div></div><label className="field-label" htmlFor="editor-url">URL do code-server</label><input id="editor-url" className="text-field" type="url" placeholder="https://ide.seudominio.com" value={urlDraft} onChange={event => setUrlDraft(event.target.value)} /><p className="field-help">Atual: <code>{publicEditorUrl}</code>. Para acesso remoto, proteja o domínio com Cloudflare Access e mantenha a senha do code-server.</p><div className="form-actions"><button className="primary-btn" onClick={saveEditorUrl}><Check size={17} /> Salvar neste navegador</button><button className="outline-btn" onClick={() => { setUrlDraft(''); setCustomEditorUrl(''); try { localStorage.removeItem('termux-studio-editor-url') } catch { /* no-op */ }; setToast('URL padrão restaurada.') }}>Restaurar</button></div></section><section className="settings-panel"><div className="settings-heading"><span className="info-badge"><ShieldCheck size={20} /></span><div><h2>Checklist de segurança</h2><p>Antes de publicar seu editor.</p></div></div><ul className="safety-list"><li><Check size={17} /> code-server com autenticação por senha</li><li><Check size={17} /> Portas 8080 e 4173 somente em 127.0.0.1</li><li><Check size={17} /> Cloudflare Access em ambos os domínios</li><li><Check size={17} /> HTTPS e políticas de acesso privadas</li></ul><p className="field-help">Nunca use <code>--auth none</code> para publicar o editor na internet.</p></section><section className="settings-panel"><div className="settings-heading"><span className="info-badge"><Monitor size={20} /></span><div><h2>Informações do serviço</h2><p>Detalhes detectados pelo painel.</p></div></div><div className="detail-row"><span>Servidor</span><strong>{data?.device.hostname || '—'}</strong></div><div className="detail-row"><span>Arquitetura</span><strong>{data?.device.arch || '—'}</strong></div><div className="detail-row"><span>Editor</span><strong>{data?.editor.online ? 'Online' : 'Offline'}</strong></div><div className="detail-row"><span>Projetos</span><strong>{data?.projects.length ?? '—'}</strong></div></section><section className="settings-panel"><div className="settings-heading"><span className="info-badge"><BookOpen size={20} /></span><div><h2>Como começar</h2><p>Passos básicos de utilização.</p></div></div><ol className="setup-list"><li>Instale o code-server no Debian e execute o painel.</li><li>Abra <code>http://127.0.0.1:4173</code> no próprio dispositivo.</li><li>Configure dois domínios HTTPS com Cloudflare Tunnel e Access.</li><li>Informe a URL do editor acima e abra seus projetos.</li></ol></section></div></>}
          <footer className="footer"><span><Code2 size={15} /> Termux Studio <span className="footer-version">v0.1.0</span></span><span>React + code-server · Desenvolvido para ARM64</span></footer>
        </div>
      </main>
      {toast && <div className="toast" role="status"><CircleHelp size={18} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="Fechar mensagem"><X size={16} /></button></div>}
    </div>
  )
}
