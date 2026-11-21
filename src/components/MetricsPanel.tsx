import { useState } from 'react'
import { Activity, CheckCircle2, Clock, Inbox, Timer, XCircle } from 'lucide-react'
import { average, useStore, type ThroughputPoint } from '../state/store'
import { Card } from './ui'

export function MetricsPanel() {
  const metrics = useStore((s) => s.metrics)
  const durations = useStore((s) => s.durations)
  const throughput = useStore((s) => s.throughput)
  const worker = metrics?.worker

  const grpc = average(durations.grpc)
  const endToEnd = average(durations.endToEnd)

  return (
    <Card title="Métricas ao vivo" icon={<Activity className="size-4 text-emerald-300" />}>
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<CheckCircle2 className="size-3.5 text-green-300" />} label="Concluídos" value={worker?.completed ?? '-'} />
        <Stat icon={<XCircle className="size-3.5 text-rose-300" />} label="Falharam (DLQ)" value={worker?.failed ?? '-'} />
        <Stat icon={<Inbox className="size-3.5 text-amber-300" />} label="Na fila agora" value={metrics?.queueDepth ?? '-'} />
        <Stat icon={<Clock className="size-3.5 text-sky-300" />} label="Latência gRPC" value={grpc !== null ? `${grpc} ms` : '-'}
          hint="Tempo da chamada PlaceOrder (média)" />
        <Stat icon={<Timer className="size-3.5 text-violet-300" />} label="Ponta a ponta" value={endToEnd !== null ? formatMs(endToEnd) : '-'}
          hint="Do POST até COMPLETED (média)" wide />
      </div>

      <Sparkline points={throughput} />
      <TimeBreakdown
        grpc={grpc}
        queue={average(durations.queueWait)}
        processing={average(durations.processing)}
      />
    </Card>
  )
}

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`
}

function Stat({ icon, label, value, hint, wide }: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: string
  wide?: boolean
}) {
  return (
    <div className={`rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 ${wide ? 'col-span-2' : ''}`} title={hint}>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">{icon}{label}</div>
      <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-slate-50">{value}</div>
    </div>
  )
}

/** Serie unica: pedidos concluidos por segundo nos ultimos 60s. Hover = crosshair + tooltip. */
function Sparkline({ points }: { points: ThroughputPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 300
  const height = 64
  const pad = 4
  const max = Math.max(1, ...points.map((p) => p.value))
  const step = (width - pad * 2) / Math.max(1, 59)
  const offset = 60 - points.length
  const xy = points.map((p, i) => [pad + (i + offset) * step, height - pad - (p.value / max) * (height - pad * 2)] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = xy.length ? `${line} L${xy[xy.length - 1][0]},${height - pad} L${xy[0][0]},${height - pad} Z` : ''
  const hovered = hover !== null ? points[hover] : null

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!points.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * width
    const index = Math.round((x - pad) / step) - offset
    setHover(Math.max(0, Math.min(points.length - 1, index)))
  }

  return (
    <figure className="mt-4">
      <figcaption className="mb-1 flex items-baseline justify-between text-[11px] text-slate-400">
        <span>Pedidos concluídos por segundo · últimos 60 s</span>
        <span className="font-mono text-slate-200">
          {hovered ? `${hovered.value}/s · ${new Date(hovered.t).toLocaleTimeString('pt-BR')}` : `pico ${max}/s`}
        </span>
      </figcaption>
      <div className="relative rounded-xl bg-[var(--chart-surface)] p-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full touch-none" preserveAspectRatio="none"
          onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img"
          aria-label={`Pedidos concluídos por segundo. Pico de ${max} por segundo.`}>
          <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#334155" strokeWidth={1} />
          {area && <path d={area} fill="var(--series-1)" fillOpacity={0.15} />}
          {line && <path d={line} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          {hover !== null && xy[hover] && (
            <>
              <line x1={xy[hover][0]} x2={xy[hover][0]} y1={pad} y2={height - pad} stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <circle cx={xy[hover][0]} cy={xy[hover][1]} r={4} fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
      </div>
    </figure>
  )
}

const SEGMENTS = [
  { key: 'grpc', label: 'gRPC', color: 'var(--series-1)', description: 'Chamada PlaceOrder (client → server)' },
  { key: 'queue', label: 'Espera na fila', color: 'var(--series-2)', description: 'Tempo parado no RabbitMQ até o worker consumir' },
  { key: 'processing', label: 'Processamento', color: 'var(--series-3)', description: 'Worker processando (inclui novas tentativas)' },
] as const

/** Barra segmentada: onde o tempo medio de um pedido e gasto. */
function TimeBreakdown(values: { grpc: number | null; queue: number | null; processing: number | null }) {
  const [hover, setHover] = useState<string | null>(null)
  const data = SEGMENTS.map((s) => ({ ...s, value: values[s.key] ?? 0 }))
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const active = data.find((d) => d.key === hover)

  return (
    <figure className="mt-4">
      <figcaption className="mb-1.5 flex items-baseline justify-between text-[11px] text-slate-400">
        <span>Onde o tempo é gasto (média por pedido)</span>
        <span className="font-mono text-slate-200">
          {active ? `${active.label}: ${formatMs(active.value)}` : total ? formatMs(total) : ''}
        </span>
      </figcaption>
      {total === 0 ? (
        <div className="rounded-xl bg-[var(--chart-surface)] px-3 py-3 text-center text-[11px] text-slate-500">
          Envie pedidos para ver a distribuição
        </div>
      ) : (
        <>
          {/* gap-[2px] = espaçador de 2px entre segmentos; pontas arredondadas de 4px */}
          <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px] bg-[var(--chart-surface)]" role="img"
            aria-label={data.map((d) => `${d.label} ${formatMs(d.value)}`).join(', ')}>
            {data.filter((d) => d.value > 0).map((d) => (
              <div key={d.key} title={`${d.label}: ${formatMs(d.value)} - ${d.description}`}
                onPointerEnter={() => setHover(d.key)} onPointerLeave={() => setHover(null)}
                className="h-full min-w-[3px] transition-opacity first:rounded-l-[4px] last:rounded-r-[4px]"
                style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color, opacity: hover && hover !== d.key ? 0.45 : 1 }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300">
            {data.map((d) => (
              <li key={d.key} className="flex items-center gap-1.5" onPointerEnter={() => setHover(d.key)} onPointerLeave={() => setHover(null)}>
                <span className="size-2 rounded-[2px]" style={{ backgroundColor: d.color }} />
                {d.label} <span className="font-mono text-slate-400">{formatMs(d.value)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  )
}
