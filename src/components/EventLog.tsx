import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { ScrollText } from 'lucide-react'
import { SERVICE_TONE, STAGES, TONE_CLASSES } from '../lib/stages'
import { useStore } from '../state/store'
import { Card } from './ui'

export const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(ts % 1000).padStart(3, '0')

export function EventLog() {
  const log = useStore((s) => s.log)
  const selectOrder = useStore((s) => s.selectOrder)

  return (
    <Card title="Eventos em tempo real" icon={<ScrollText className="size-4 text-amber-300" />}
      action={<span className="font-mono text-[11px] text-slate-500">order.events → SSE</span>}
      className="flex min-h-0 flex-col">
      {log.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Nenhum evento ainda. Envie um pedido para ver o fluxo acontecer.
        </p>
      ) : (
        <ol className="scrollbar-thin -mx-2 max-h-[560px] overflow-y-auto font-mono text-[11px]">
          <AnimatePresence initial={false}>
            {log.map((event) => {
              const meta = STAGES[event.stage]
              const service = TONE_CLASSES[SERVICE_TONE[event.service] ?? 'slate']
              return (
                <motion.li key={`${event.orderId}-${event.stage}-${event.timestamp}`}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
                  <button type="button" onClick={() => selectOrder(event.orderId)}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                    <span className="shrink-0 text-slate-500">{formatTime(event.timestamp)}</span>
                    <span className={clsx('mt-1 size-1.5 shrink-0 rounded-full', TONE_CLASSES[meta?.tone ?? 'slate'].dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold text-slate-100">{event.stage}</span>
                        <span className={service.text}>{event.service}</span>
                        <span className="text-slate-500">#{event.orderId.slice(0, 8)}</span>
                      </span>
                      <span className="block truncate font-sans text-slate-400">{event.message}</span>
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </Card>
  )
}
