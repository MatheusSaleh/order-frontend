import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { FlaskConical, Minus, Plus, RotateCcw, Send, ShoppingCart, Zap } from 'lucide-react'
import { api } from '../lib/api'
import type { Product } from '../lib/types'
import { useStore } from '../state/store'
import { Button, Card, Switch } from './ui'

const FALLBACK_CATALOG: Product[] = [
  { id: 'kb-01', name: 'Teclado Mecanico', price: 389.9, emoji: '⌨️' },
  { id: 'ms-02', name: 'Mouse Gamer', price: 189.9, emoji: '🖱️' },
  { id: 'hs-04', name: 'Headset', price: 299.9, emoji: '🎧' },
  { id: 'cf-08', name: 'Cafe Especial 1kg', price: 89.9, emoji: '☕' },
]

const NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Felipe', 'Gabi', 'Heitor', 'Isis', 'João']
const randomName = () => NAMES[Math.floor(Math.random() * NAMES.length)]

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function useSampleOrder() {
  return async () => {
    const catalog = await api.catalog().catch(() => FALLBACK_CATALOG)
    const product = catalog[Math.floor(Math.random() * catalog.length)]
    await api.placeOrder(randomName(), [
      { productId: product.id, productName: product.name, quantity: 1, price: product.price },
    ])
  }
}

export function ControlPanel() {
  const [catalog, setCatalog] = useState<Product[]>(FALLBACK_CATALOG)
  const [cart, setCart] = useState<Record<string, number>>({ 'kb-01': 1 })
  const [customer, setCustomer] = useState(randomName)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const mode = useStore((s) => s.mode)

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => undefined)
  }, [])

  const items = useMemo(
    () =>
      catalog
        .filter((p) => cart[p.id])
        .map((p) => ({ productId: p.id, productName: p.name, quantity: cart[p.id], price: p.price })),
    [catalog, cart],
  )
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setFeedback(null)
    try {
      setFeedback({ ok: true, text: await action() })
    } catch (e) {
      setFeedback({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const submit = () =>
    run(async () => {
      const response = await api.placeOrder(customer.trim() || randomName(), items)
      setCustomer(randomName())
      return `Pedido ${response.orderId.slice(0, 8)} → ${response.status}`
    })

  const changeQty = (id: string, delta: number) =>
    setCart((current) => {
      const next = { ...current, [id]: Math.max(0, Math.min(9, (current[id] ?? 0) + delta)) }
      if (!next[id]) delete next[id]
      return next
    })

  return (
    <div className="flex flex-col gap-4">
      <Card title="Novo pedido" icon={<ShoppingCart className="size-4 text-sky-300" />}>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-slate-400">Cliente</span>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:border-sky-400/60"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          {catalog.map((product) => {
            const qty = cart[product.id] ?? 0
            return (
              <div
                key={product.id}
                className={clsx(
                  'flex flex-col rounded-xl border p-2 text-xs transition',
                  qty ? 'border-sky-400/50 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]',
                )}
              >
                <button type="button" className="flex items-center gap-1.5 text-left" onClick={() => changeQty(product.id, qty ? -qty : 1)}>
                  <span className="text-base">{product.emoji}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-100">{product.name}</span>
                    <span className="text-slate-400">{currency.format(product.price)}</span>
                  </span>
                </button>
                {qty > 0 && (
                  <div className="mt-1.5 flex items-center justify-end gap-1">
                    <button type="button" aria-label="Diminuir" onClick={() => changeQty(product.id, -1)} className="rounded-md bg-white/10 p-0.5 hover:bg-white/20">
                      <Minus className="size-3" />
                    </button>
                    <span className="w-4 text-center font-mono">{qty}</span>
                    <button type="button" aria-label="Aumentar" onClick={() => changeQty(product.id, 1)} className="rounded-md bg-white/10 p-0.5 hover:bg-white/20">
                      <Plus className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Total <span className="block font-mono text-base text-slate-100">{currency.format(total)}</span>
          </div>
          <Button variant="primary" onClick={submit} disabled={busy || items.length === 0}>
            <Send className="size-4" /> Enviar pedido
          </Button>
        </div>
      </Card>

      <ScenarioPanel run={run} busy={busy} didactic={mode === 'didactic'} />

      {feedback && (
        <p role="status" className={clsx('rounded-xl px-3 py-2 text-xs', feedback.ok ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200')}>
          {feedback.text}
        </p>
      )}
    </div>
  )
}

function ScenarioPanel({ run, busy, didactic }: {
  run: (action: () => Promise<string>) => void
  busy: boolean
  didactic: boolean
}) {
  const worker = useStore((s) => s.metrics?.worker)
  const dlqDepth = useStore((s) => s.metrics?.dlqDepth ?? 0)
  const [failure, setFailure] = useState(0)
  const [delay, setDelay] = useState(1200)
  const [dragging, setDragging] = useState(false)

  // Mantem os sliders sincronizados com o estado real do worker
  useEffect(() => {
    if (worker && !dragging) {
      setFailure(Math.round(worker.failureRate * 100))
      setDelay(worker.processingDelayMs)
    }
  }, [worker, dragging])

  const commit = (changes: Parameters<typeof api.updateWorker>[0], text: string) =>
    run(async () => {
      await api.updateWorker(changes)
      return text
    })

  return (
    <Card title="Cenários" icon={<FlaskConical className="size-4 text-violet-300" />}>
      <div className="flex flex-col gap-4">
        <Scenario hint={didactic ? 'Desative o modo didático para disparar rajadas.' : 'Observe a fila encher e o worker processar um por vez.'}>
          <div className="grid grid-cols-2 gap-2">
            {[20, 50].map((count) => (
              <Button key={count} disabled={busy || didactic} onClick={() => run(async () => {
                await api.burst(count)
                return `${count} pedidos disparados`
              })}>
                <Zap className="size-4 text-amber-300" /> {count} pedidos
              </Button>
            ))}
          </div>
        </Scenario>

        <Scenario hint="Desligue o worker: as mensagens se acumulam no RabbitMQ e nenhuma se perde. Ao religar, a fila esvazia.">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">
              Worker {worker ? (worker.running ? 'ligado' : 'desligado') : 'indisponível'}
            </span>
            <Switch
              label="Ligar ou desligar o worker"
              checked={worker?.running ?? false}
              onChange={(running) => commit({ running }, running ? 'Worker religado' : 'Worker desligado')}
            />
          </div>
        </Scenario>

        <Scenario hint={`Cada tentativa falha com essa probabilidade. Após ${worker?.maxAttempts ?? 3} falhas o pedido vai para a DLQ.`}>
          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm">
              <span>Taxa de falha</span>
              <span className={clsx('font-mono', failure > 0 ? 'text-rose-300' : 'text-slate-400')}>{failure}%</span>
            </span>
            <input
              type="range" min={0} max={100} step={5} value={failure}
              onChange={(e) => setFailure(Number(e.target.value))}
              onPointerDown={() => setDragging(true)}
              onPointerUp={() => {
                setDragging(false)
                commit({ failureRate: failure / 100 }, `Taxa de falha: ${failure}%`)
              }}
              onKeyUp={() => commit({ failureRate: failure / 100 }, `Taxa de falha: ${failure}%`)}
            />
          </label>
        </Scenario>

        <Scenario hint="Tempo que o worker leva para processar cada tentativa.">
          <label className="block">
            <span className="mb-1.5 flex justify-between text-sm">
              <span>Tempo de processamento</span>
              <span className="font-mono text-slate-400">{(delay / 1000).toFixed(1)}s</span>
            </span>
            <input
              type="range" min={200} max={5000} step={100} value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              onPointerDown={() => setDragging(true)}
              onPointerUp={() => {
                setDragging(false)
                commit({ processingDelayMs: delay }, `Processamento: ${(delay / 1000).toFixed(1)}s`)
              }}
              onKeyUp={() => commit({ processingDelayMs: delay }, `Processamento: ${(delay / 1000).toFixed(1)}s`)}
            />
          </label>
        </Scenario>

        <Scenario hint="Devolve os pedidos com falha para a fila principal (redrive).">
          <Button variant="danger" className="w-full" disabled={busy || dlqDepth === 0} onClick={() => run(async () => {
            const { requeued } = await api.redriveDlq()
            return `${requeued} pedido(s) devolvidos à fila`
          })}>
            <RotateCcw className="size-4" /> Reprocessar DLQ ({dlqDepth})
          </Button>
        </Scenario>
      </div>
    </Card>
  )
}

function Scenario({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div>
      {children}
      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p>
    </div>
  )
}
