import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import clsx from 'clsx'
import { GraduationCap, Pause, Play, SkipForward, Sparkles } from 'lucide-react'
import { STAGES, TONE_CLASSES } from '../lib/stages'
import type { Stage } from '../lib/types'
import { useStore } from '../state/store'
import { useSampleOrder } from './ControlPanel'
import { Button } from './ui'
import { WireComparison } from './WireComparison'

/** Caminho "feliz" exibido como trilha de progresso. */
const JOURNEY: Stage[] = [
  'CLIENT_RECEIVED', 'GRPC_SENT', 'SERVER_RECEIVED', 'SAVED_PENDING', 'QUEUED',
  'GRPC_RESPONDED', 'WORKER_PICKED', 'PROCESSING', 'COMPLETED',
]

const AUTOPLAY_MS = 3500

export function DidacticPanel() {
  const currentStep = useStore((s) => s.currentStep)
  const pending = useStore((s) => s.pending.length)
  const autoplay = useStore((s) => s.autoplay)
  const setAutoplay = useStore((s) => s.setAutoplay)
  const step = useStore((s) => s.step)
  const order = useStore((s) => (currentStep ? s.orders[currentStep.orderId] : undefined))
  const sendSample = useSampleOrder()
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!autoplay || pending === 0) return
    const timer = setTimeout(step, AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [autoplay, pending, step, currentStep])

  const meta = currentStep ? STAGES[currentStep.stage] : null
  const index = currentStep ? JOURNEY.indexOf(currentStep.stage) : -1
  const extras = currentStep ? Object.entries(currentStep.data ?? {}).filter(([k]) => !['json', 'protobufHex'].includes(k)) : []

  return (
    <section className="glass relative overflow-hidden p-5" aria-live="polite">
      <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-violet-500/10 blur-3xl" />

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <GraduationCap className="size-4 text-violet-300" /> Modo didático · passo a passo
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setAutoplay(!autoplay)} aria-pressed={autoplay}>
            {autoplay ? <Pause className="size-4" /> : <Play className="size-4" />}
            {autoplay ? 'Pausar' : 'Auto-play'}
          </Button>
          <Button variant="primary" onClick={step} disabled={pending === 0}>
            Próximo passo <SkipForward className="size-4" />
            {pending > 0 && <span className="rounded-full bg-slate-950/30 px-1.5 text-xs">{pending}</span>}
          </Button>
        </div>
      </header>

      {/* Trilha de progresso */}
      <ol className="mb-5 flex items-center gap-1" aria-label="Etapas do pedido">
        {JOURNEY.map((stage, i) => (
          <li key={stage} className="flex flex-1 items-center gap-1" title={STAGES[stage].label}>
            <span className={clsx(
              'h-1.5 flex-1 rounded-full transition-colors duration-500',
              i <= index ? TONE_CLASSES[STAGES[stage].tone].dot : 'bg-white/10',
              i === index && 'animate-pulse',
            )} />
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {currentStep && meta ? (
          <motion.div key={`${currentStep.orderId}-${currentStep.stage}-${currentStep.timestamp}`}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={clsx('rounded-full px-2 py-0.5 font-mono font-semibold', TONE_CLASSES[meta.tone].bg, TONE_CLASSES[meta.tone].text)}>
                {index >= 0 ? `${index + 1}/${JOURNEY.length}` : '•'} {currentStep.stage}
              </span>
              <span className="text-slate-400">{currentStep.service}</span>
              <span className="font-mono text-slate-500">pedido #{currentStep.orderId.slice(0, 8)}</span>
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white">{meta.title}</h3>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-300">{meta.explanation}</p>

            {extras.length > 0 && (
              <dl className="mt-3 flex flex-wrap gap-2">
                {extras.map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 font-mono text-[11px]">
                    <dt className="inline text-slate-500">{key}: </dt>
                    <dd className="inline text-slate-200">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {currentStep.stage === 'GRPC_SENT' && order?.wire && (
              <div className="mt-4">
                <WireComparison wire={order.wire} />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-start gap-3 py-2">
            <p className="max-w-2xl text-sm text-slate-300">
              No modo didático, cada evento do pedido fica pausado com uma explicação do que está acontecendo e por quê.
              Envie um pedido e avance no seu ritmo.
            </p>
            <Button variant="primary" disabled={sending} onClick={async () => {
              setSending(true)
              try { await sendSample() } finally { setSending(false) }
            }}>
              <Sparkles className="size-4" /> Enviar pedido de exemplo
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
