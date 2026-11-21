import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { Database, Lightbulb, Loader2, X } from 'lucide-react'
import { api } from '../lib/api'
import { NODES } from '../lib/layout'
import { SERVICE_TONE, STAGES, TONE_CLASSES } from '../lib/stages'
import type { NodeId, OrderStatus } from '../lib/types'
import { useStore, type OrderState } from '../state/store'
import { formatTime } from './EventLog'
import { Button } from './ui'
import { WireComparison } from './WireComparison'

export function DetailDrawer() {
  const selectedOrderId = useStore((s) => s.selectedOrderId)
  const selectedNode = useStore((s) => s.selectedNode)
  const order = useStore((s) => (selectedOrderId ? s.orders[selectedOrderId] : undefined))
  const selectOrder = useStore((s) => s.selectOrder)
  const open = Boolean(order || selectedNode)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => selectOrder(null)} />
          <motion.aside
            className="scrollbar-thin fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-white/10 bg-slate-950/95 p-6 shadow-2xl"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            role="dialog" aria-modal="true">
            <button type="button" onClick={() => selectOrder(null)} aria-label="Fechar"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
              <X className="size-5" />
            </button>
            {order ? <OrderDetail key={order.id} order={order} /> : selectedNode && <NodeDetail id={selectedNode} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function OrderDetail({ order }: { order: OrderState }) {
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const start = order.events[0]?.timestamp ?? 0
  const meta = STAGES[order.stage]

  const query = async () => {
    setLoading(true)
    setError(null)
    try {
      setStatus(await api.orderStatus(order.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="font-mono text-xs text-slate-500">pedido</p>
      <h2 className="break-all font-mono text-lg font-semibold text-white">{order.id}</h2>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-slate-300">{order.customerName ?? 'Cliente'}</span>
        <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', TONE_CLASSES[meta.tone].bg, TONE_CLASSES[meta.tone].text)}>
          {meta.label}
        </span>
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-200">Linha do tempo</h3>
      <ol className="relative ml-2 border-l border-white/10">
        {order.events.map((event) => {
          const m = STAGES[event.stage]
          return (
            <li key={`${event.stage}-${event.timestamp}`} className="mb-4 ml-4">
              <span className={clsx('absolute -left-[5px] mt-1.5 size-2.5 rounded-full ring-4 ring-slate-950', TONE_CLASSES[m.tone].dot)} />
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-mono font-semibold text-slate-100">{event.stage}</span>
                <span className={TONE_CLASSES[SERVICE_TONE[event.service] ?? 'slate'].text}>{event.service}</span>
                <span className="ml-auto font-mono text-slate-500">+{event.timestamp - start} ms</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">{event.message}</p>
              <p className="font-mono text-[10px] text-slate-600">{formatTime(event.timestamp)}</p>
            </li>
          )
        })}
      </ol>

      {order.wire && (
        <>
          <h3 className="mb-3 mt-4 text-sm font-semibold text-slate-200">O que trafegou na rede</h3>
          <WireComparison wire={order.wire} />
        </>
      )}

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-200">Consultar estado atual</h3>
      <p className="mb-3 text-xs text-slate-400">
        Faz <code className="text-slate-300">GET /api/orders/{'{id}'}</code>, que chama o gRPC{' '}
        <code className="text-slate-300">GetOrderStatus</code> no order-server, que lê o documento no MongoDB.
      </p>
      <Button onClick={query} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4 text-green-300" />}
        Consultar via gRPC
      </Button>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {status && (
        <pre className="scrollbar-thin mt-3 max-h-72 overflow-auto rounded-xl border border-white/10 bg-slate-900/80 p-3 font-mono text-[11px] text-green-100/90">
          {JSON.stringify(status, null, 2)}
        </pre>
      )}
    </div>
  )
}

function NodeDetail({ id }: { id: NodeId }) {
  const spec = NODES[id]
  const tone = TONE_CLASSES[spec.tone]
  return (
    <div>
      <p className={clsx('text-xs font-semibold uppercase tracking-wider', tone.text)}>{spec.role}</p>
      <h2 className="mt-1 text-2xl font-semibold text-white">{spec.title}</h2>
      <p className="font-mono text-xs text-slate-500">{spec.subtitle}</p>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">{spec.description}</p>
      <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-200">
          <Lightbulb className="size-4" /> Por que assim?
        </p>
        <p className="text-sm leading-relaxed text-slate-300">{spec.why}</p>
      </div>
      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-200">Tecnologias</h3>
      <ul className="flex flex-wrap gap-2">
        {spec.tech.map((t) => (
          <li key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">{t}</li>
        ))}
      </ul>
    </div>
  )
}
