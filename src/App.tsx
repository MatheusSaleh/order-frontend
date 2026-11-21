import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { GraduationCap, MousePointerClick, Sparkles } from 'lucide-react'
import { ControlPanel, useSampleOrder } from './components/ControlPanel'
import { DetailDrawer } from './components/DetailDrawer'
import { DidacticPanel } from './components/DidacticPanel'
import { EventLog } from './components/EventLog'
import { Header, REPO_URL } from './components/Header'
import { MetricsPanel } from './components/MetricsPanel'
import { PipelineCanvas } from './components/PipelineCanvas'
import { Button } from './components/ui'
import { useEventStream } from './hooks/useEventStream'
import { useStore } from './state/store'

const LEGEND = [
  ['bg-sky-400', 'trafegando (REST/gRPC)'],
  ['bg-violet-400', 'no servidor'],
  ['bg-amber-400', 'na fila'],
  ['bg-emerald-400', 'processando'],
  ['bg-yellow-300', 'nova tentativa'],
  ['bg-green-400', 'concluído'],
  ['bg-rose-400', 'DLQ'],
] as const

export default function App() {
  useEventStream()
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const sendSample = useSampleOrder()
  const [sending, setSending] = useState(false)

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Header />

      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Acompanhe um pedido atravessando{' '}
            <span className="bg-gradient-to-r from-sky-300 via-violet-300 to-emerald-300 bg-clip-text text-transparent">
              4 microsserviços
            </span>{' '}
            em tempo real
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Cada bolinha é um pedido real: ela vira Protobuf, cruza uma chamada gRPC, espera numa fila do RabbitMQ e é
            processada por um worker, que grava o resultado no MongoDB. Clique em qualquer serviço ou pedido para ver os detalhes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={sending} onClick={async () => {
            setSending(true)
            try { await sendSample() } finally { setSending(false) }
          }}>
            <Sparkles className="size-4" /> Enviar pedido de exemplo
          </Button>
          {mode === 'live' && (
            <Button onClick={() => setMode('didactic')}>
              <GraduationCap className="size-4" /> Explicar passo a passo
            </Button>
          )}
        </div>
      </section>

      <section className="glass grid-bg relative p-3 sm:p-5">
        <PipelineCanvas />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-slate-400">
          {LEGEND.map(([color, label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${color}`} /> {label}
            </span>
          ))}
          <span className="ml-auto hidden items-center gap-1.5 text-slate-500 md:flex">
            <MousePointerClick className="size-3.5" /> clique nos serviços e nos pedidos
          </span>
        </div>
      </section>

      <AnimatePresence>
        {mode === 'didactic' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <DidacticPanel />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,360px)_minmax(0,1fr)]">
        <ControlPanel />
        <MetricsPanel />
        <EventLog />
      </main>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4 text-xs text-slate-500">
        <span>Java 21 · Spring Boot 4.2 · gRPC · RabbitMQ · MongoDB · React · Docker Compose</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-slate-300">Ver código no GitHub →</a>
      </footer>

      <DetailDrawer />
    </div>
  )
}
