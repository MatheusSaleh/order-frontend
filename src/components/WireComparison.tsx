import { motion } from 'motion/react'
import type { WireInfo } from '../state/store'

/** JSON x Protobuf do mesmo pedido: conteudo e tamanho em bytes. */
export function WireComparison({ wire }: { wire: WireInfo }) {
  const max = Math.max(wire.jsonBytes, wire.protobufBytes, 1)
  const saving = wire.jsonBytes ? Math.round((1 - wire.protobufBytes / wire.jsonBytes) * 100) : 0
  let pretty = wire.json
  try {
    pretty = JSON.stringify(JSON.parse(wire.json), null, 2)
  } catch {
    /* mantem original */
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Panel title="JSON (HTTP/1.1, texto)" bytes={wire.jsonBytes} ratio={wire.jsonBytes / max} color="#fbbf24">
        <pre className="scrollbar-thin max-h-44 overflow-auto whitespace-pre-wrap break-all text-amber-100/90">{pretty}</pre>
      </Panel>
      <Panel title="Protobuf (HTTP/2, binário)" bytes={wire.protobufBytes} ratio={wire.protobufBytes / max} color="#38bdf8"
        badge={saving > 0 ? `${saving}% menor` : undefined}>
        <pre className="scrollbar-thin max-h-44 overflow-auto whitespace-pre-wrap break-all text-sky-100/90">{wire.protobufHex}</pre>
        <p className="mt-2 font-sans text-[11px] text-slate-500">
          Sem nomes de campo: cada campo vira um número (tag) definido no <code>.proto</code>.
        </p>
      </Panel>
    </div>
  )
}

function Panel({ title, bytes, ratio, color, badge, children }: {
  title: string
  bytes: number
  ratio: number
  color: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 font-mono text-[11px]">
      <div className="mb-2 flex items-center justify-between gap-2 font-sans text-xs">
        <span className="text-slate-300">{title}</span>
        <span className="flex items-center gap-2">
          {badge && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">{badge}</span>}
          <span className="font-mono text-slate-100">{bytes} bytes</span>
        </span>
      </div>
      <div className="mb-2 h-1.5 rounded-full bg-white/5">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
          initial={{ width: 0 }} animate={{ width: `${Math.max(3, ratio * 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
      </div>
      {children}
    </div>
  )
}
