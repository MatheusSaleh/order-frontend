import { motion } from 'motion/react'
import clsx from 'clsx'
import { AlertTriangle, Cpu, Database, Globe, Inbox, Network, Server } from 'lucide-react'
import { NODES } from '../lib/layout'
import { TONE_CLASSES, TONE_HEX } from '../lib/stages'
import type { NodeId } from '../lib/types'
import { useStore } from '../state/store'

const ICONS: Record<NodeId, typeof Globe> = {
  browser: Globe,
  client: Network,
  server: Server,
  queue: Inbox,
  worker: Cpu,
  mongo: Database,
  dlq: AlertTriangle,
}

interface Props {
  id: NodeId
  focused: boolean
  dimmed: boolean
  overflow: number
  pulseKey?: number
}

export function ServiceNode({ id, focused, dimmed, overflow, pulseKey }: Props) {
  const spec = NODES[id]
  const Icon = ICONS[id]
  const tone = TONE_CLASSES[spec.tone]
  const color = TONE_HEX[spec.tone]
  const selectNode = useStore((s) => s.selectNode)
  const selected = useStore((s) => s.selectedNode === id)

  return (
    <motion.button
      type="button"
      onClick={() => selectNode(id)}
      className={clsx(
        'group absolute flex cursor-pointer flex-col rounded-2xl border bg-slate-900/95 px-3 py-2.5 text-left transition-[opacity,border-color,box-shadow] duration-300',
        'hover:border-white/30 focus-visible:outline-2 focus-visible:outline-white',
        focused || selected ? 'border-white/40' : 'border-white/10',
        dimmed && 'opacity-40',
      )}
      style={{
        left: spec.x - spec.w / 2,
        top: spec.y - spec.h / 2,
        width: spec.w,
        height: spec.h,
        boxShadow: focused || selected ? `0 0 0 1px ${color}66, 0 0 36px -6px ${color}aa` : undefined,
      }}
      aria-label={`${spec.title}: ${spec.role}. Clique para detalhes.`}
    >
      {/* Brilho a cada evento que envolve este no */}
      {pulseKey !== undefined && (
        <motion.span
          key={pulseKey}
          className="pointer-events-none absolute inset-0 rounded-2xl"
          initial={{ boxShadow: `0 0 0 0px ${color}aa` }}
          animate={{ boxShadow: `0 0 0 10px ${color}00` }}
          transition={{ duration: 0.7 }}
        />
      )}

      <div className="flex items-center gap-2">
        <span className={clsx('grid size-7 shrink-0 place-items-center rounded-lg', tone.bg)}>
          <Icon className={clsx('size-4', tone.text)} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight text-slate-100">{spec.title}</div>
          <div className="truncate font-mono text-[10px] text-slate-400">{spec.subtitle}</div>
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between gap-1">
        <NodeBadge id={id} />
        {overflow > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 font-mono text-[10px] text-slate-200">+{overflow}</span>
        )}
      </div>
    </motion.button>
  )
}

/** Informacao viva exibida no rodape de cada no. */
function NodeBadge({ id }: { id: NodeId }) {
  const metrics = useStore((s) => s.metrics)
  const connection = useStore((s) => s.connection)
  const worker = metrics?.worker

  const badge = (text: string, className = 'text-slate-400') => (
    <span className={clsx('font-mono text-[10px]', className)}>{text}</span>
  )

  switch (id) {
    case 'browser':
      return badge(connection === 'open' ? '● SSE conectado' : '○ conectando…',
        connection === 'open' ? 'text-emerald-300' : 'text-amber-300')
    case 'queue':
      return badge(`${metrics?.queueDepth ?? 0} msg na fila`, (metrics?.queueDepth ?? 0) > 0 ? 'text-amber-300' : undefined)
    case 'dlq':
      return badge(`${metrics?.dlqDepth ?? 0} msg`, (metrics?.dlqDepth ?? 0) > 0 ? 'text-rose-300' : undefined)
    case 'worker':
      if (!worker) return badge('indisponível', 'text-rose-300')
      return worker.running
        ? badge(`● ativo · ${(worker.processingDelayMs / 1000).toFixed(1)}s`, 'text-emerald-300')
        : badge('■ pausado', 'text-rose-300')
    case 'mongo':
      return badge(worker ? `${worker.completed} concluídos` : 'orders')
    case 'server':
      return badge(':9090 gRPC')
    case 'client':
      return badge(':8080 REST')
  }
}
