import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { CANVAS_HEIGHT, CANVAS_WIDTH, EDGES, NODES, SLOTS, slotPosition } from '../lib/layout'
import { STAGES, TONE_HEX } from '../lib/stages'
import type { NodeId } from '../lib/types'
import { useStore, type OrderState } from '../state/store'
import { ServiceNode } from './ServiceNode'

const TOKEN_SIZE = 18

/** Escala o diagrama (desenhado em CANVAS_WIDTH x CANVAS_HEIGHT) para a largura do container. */
function useScale() {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1.25, Math.max(0.62, entry.contentRect.width / CANVAS_WIDTH)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, scale }
}

export function PipelineCanvas() {
  const { ref, scale } = useScale()
  const orders = useStore((s) => s.orders)
  const orderIds = useStore((s) => s.orderIds)
  const packets = useStore((s) => s.packets)
  const currentStep = useStore((s) => s.currentStep)
  const mode = useStore((s) => s.mode)
  const latest = useStore((s) => s.log[0])

  const focus = useMemo<Set<NodeId>>(() => {
    if (mode !== 'didactic' || !currentStep) return new Set()
    return new Set(STAGES[currentStep.stage].focus)
  }, [mode, currentStep])

  // Agrupa os tokens visiveis por local
  const groups = useMemo(() => {
    const byLocation: Record<string, OrderState[]> = {}
    for (const id of orderIds) {
      const order = orders[id]
      if (!order || order.hidden) continue
      ;(byLocation[order.location] ??= []).push(order)
    }
    byLocation.queue?.sort((a, b) => (a.queuedAt ?? 0) - (b.queuedAt ?? 0))
    return byLocation
  }, [orders, orderIds])

  const overflow: Partial<Record<string, number>> = {}
  const tokens: { order: OrderState; x: number; y: number }[] = []
  for (const [location, list] of Object.entries(groups)) {
    const max = SLOTS[location]?.max ?? 3
    overflow[location] = Math.max(0, list.length - max)
    list.slice(0, max).forEach((order, index) => {
      tokens.push({ order, ...slotPosition(location, index, list.length) })
    })
  }

  return (
    <div ref={ref} className="w-full overflow-x-auto overflow-y-hidden">
      <div style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}>
        <div
          className="relative origin-top-left"
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${scale})` }}
        >
          <Edges focus={focus} />

          {(Object.keys(NODES) as NodeId[]).map((id) => (
            <ServiceNode
              key={id}
              id={id}
              focused={focus.has(id)}
              dimmed={focus.size > 0 && !focus.has(id)}
              overflow={overflow[id] ?? 0}
              pulseKey={latest && STAGES[latest.stage]?.focus.includes(id) ? latest.timestamp : undefined}
            />
          ))}

          <EdgeLabels focus={focus} />

          {/* Pacotes: animacoes curtas de trafego (escrita no banco, resposta gRPC...) */}
          <AnimatePresence>
            {packets.map((packet) => (
              <PacketDot key={packet.id} {...packet} />
            ))}
          </AnimatePresence>

          {/* Tokens: um por pedido, percorrendo o pipeline */}
          <AnimatePresence>
            {tokens.map(({ order, x, y }) => (
              <Token key={order.id} order={order} x={x} y={y} />
            ))}
          </AnimatePresence>

          {(overflow.wire ?? 0) > 0 && (
            <span className="absolute rounded-full bg-sky-500/20 px-1.5 text-[10px] text-sky-200"
              style={{ left: SLOTS.wire.x - 12, top: SLOTS.wire.y + 14 }}>
              +{overflow.wire}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Edges({ focus }: { focus: Set<NodeId> }) {
  return (
    <svg className="pointer-events-none absolute inset-0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
      <defs>
        <linearGradient id="edge-gradient" x1="0" x2="1">
          <stop offset="0%" stopColor="#64748b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {EDGES.map((edge) => {
        const a = NODES[edge.from]
        const b = NODES[edge.to]
        const active = focus.has(edge.from) && focus.has(edge.to)
        const dimmed = focus.size > 0 && !active
        return (
          <g key={`${edge.from}-${edge.to}`} opacity={dimmed ? 0.25 : 1}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={active ? TONE_HEX[NODES[edge.to].tone] : 'url(#edge-gradient)'}
              strokeWidth={active ? 2.5 : 1.5} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={active ? TONE_HEX[NODES[edge.to].tone] : '#94a3b8'}
              strokeOpacity={active ? 0.9 : 0.35}
              strokeWidth={2} strokeDasharray="3 9" className="edge-flow" />
          </g>
        )
      })}
    </svg>
  )
}

/** Rotulos acima dos nos (com fundo) para nunca serem cortados. */
function EdgeLabels({ focus }: { focus: Set<NodeId> }) {
  return (
    <>
      {EDGES.map((edge) => {
        const a = NODES[edge.from]
        const b = NODES[edge.to]
        const vertical = Math.abs(a.x - b.x) < 10
        const active = focus.has(edge.from) && focus.has(edge.to)
        return (
          <span key={`${edge.from}-${edge.to}-label`}
            className={clsx(
              'pointer-events-none absolute z-10 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-950/90 px-1.5 py-0.5 font-mono text-[10px] tracking-wide',
              active ? 'text-white' : 'text-slate-400',
              !vertical && '-translate-x-1/2',
              focus.size > 0 && !active && 'opacity-30',
            )}
            style={{
              left: vertical ? a.x + 10 : (a.x + b.x) / 2,
              top: vertical ? (a.y + b.y) / 2 : (a.y + b.y) / 2 - 16,
            }}>
            {edge.label}
          </span>
        )
      })}
    </>
  )
}

function Token({ order, x, y }: { order: OrderState; x: number; y: number }) {
  const selectOrder = useStore((s) => s.selectOrder)
  const selected = useStore((s) => s.selectedOrderId === order.id)
  const meta = STAGES[order.stage]
  const color = TONE_HEX[meta.tone]
  const isNew = order.events.length <= 1 && order.stage === 'CLIENT_RECEIVED'
  const start = isNew ? NODES.browser : { x, y }
  const busy = order.stage === 'PROCESSING' || order.stage === 'WORKER_PICKED'

  return (
    <motion.button
      type="button"
      onClick={() => selectOrder(order.id)}
      title={`${order.customerName ?? 'Pedido'} · ${meta.label}`}
      aria-label={`Pedido de ${order.customerName ?? order.id}: ${meta.label}`}
      className={clsx(
        'absolute z-20 grid cursor-pointer place-items-center rounded-full text-[9px] font-bold text-slate-950 shadow-lg outline-none',
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-slate-950',
      )}
      style={{
        width: TOKEN_SIZE,
        height: TOKEN_SIZE,
        left: -TOKEN_SIZE / 2,
        top: -TOKEN_SIZE / 2,
        backgroundColor: color,
        boxShadow: `0 0 14px ${color}aa`,
      }}
      initial={{ x: start.x, y: start.y, scale: 0 }}
      animate={{ x, y, scale: 1, backgroundColor: color }}
      exit={{ scale: 0, opacity: 0, transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 140, damping: 20, mass: 0.8 }}
      whileHover={{ scale: 1.35 }}
    >
      {(order.customerName ?? '?').charAt(0).toUpperCase()}
      {busy && (
        <span className="absolute -inset-1 animate-spin rounded-full border-2 border-transparent border-t-emerald-200" />
      )}
      {order.stage === 'RETRY' && order.attempt && (
        <span className="absolute -right-2 -top-2 rounded-full bg-yellow-300 px-1 text-[8px] leading-3 text-slate-900">
          {order.attempt}
        </span>
      )}
    </motion.button>
  )
}

function PacketDot({ id, from, to, tone }: { id: number; from: NodeId; to: NodeId; tone: keyof typeof TONE_HEX }) {
  const removePacket = useStore((s) => s.removePacket)
  const a = NODES[from]
  const b = NODES[to]
  const color = TONE_HEX[tone]

  // Garante a remocao mesmo se a animacao for interrompida (aba em segundo plano)
  useEffect(() => {
    const timer = setTimeout(() => removePacket(id), 1500)
    return () => clearTimeout(timer)
  }, [id, removePacket])

  return (
    <motion.span
      className="pointer-events-none absolute z-10 rounded-full"
      style={{ width: 8, height: 8, left: -4, top: -4, backgroundColor: color, boxShadow: `0 0 12px 3px ${color}` }}
      initial={{ x: a.x, y: a.y, opacity: 0 }}
      animate={{ x: b.x, y: b.y, opacity: [0, 1, 1, 0] }}
      transition={{ duration: 0.75, ease: 'easeInOut' }}
      onAnimationComplete={() => removePacket(id)}
    />
  )
}
