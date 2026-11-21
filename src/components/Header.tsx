import clsx from 'clsx'
import { GraduationCap, Radio } from 'lucide-react'
import { useStore, type Mode } from '../state/store'

/** Altere para a URL do repositorio order-platform quando ele for publicado. */
export const REPO_URL = 'https://github.com/MatheusSaleh/order-platform'

const MODES: { id: Mode; label: string; icon: typeof Radio }[] = [
  { id: 'live', label: 'Ao vivo', icon: Radio },
  { id: 'didactic', label: 'Didático', icon: GraduationCap },
]

export function Header() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const connection = useStore((s) => s.connection)

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl border border-white/10 bg-slate-900">
          <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
            <circle cx="7" cy="16" r="3.5" fill="#38bdf8" />
            <circle cx="16" cy="16" r="3.5" fill="#a78bfa" />
            <circle cx="25" cy="16" r="3.5" fill="#34d399" />
            <path d="M10.5 16h2M19.5 16h2" stroke="#64748b" strokeWidth="1.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight text-white">Order Pipeline</h1>
          <p className="text-xs text-slate-400">gRPC · RabbitMQ · MongoDB · Spring Boot</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={clsx(
          'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs sm:flex',
          connection === 'open' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300',
        )}>
          <span className={clsx('size-1.5 rounded-full', connection === 'open' ? 'bg-emerald-400' : 'animate-pulse bg-amber-400')} />
          {connection === 'open' ? 'Conectado' : 'Conectando ao backend…'}
        </span>

        <div role="radiogroup" aria-label="Modo de visualização" className="flex rounded-xl border border-white/10 bg-slate-900/80 p-1">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition',
                mode === id ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-slate-200',
              )}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Código no GitHub"
          className="grid size-9 place-items-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-300 hover:text-white">
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
            <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.7 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
          </svg>
        </a>
      </div>
    </header>
  )
}
