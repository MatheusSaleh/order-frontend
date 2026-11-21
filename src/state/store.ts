import { create } from 'zustand'
import { STAGES, type TokenLocation, type Tone } from '../lib/stages'
import type { Metrics, NodeId, OrderEvent, Stage } from '../lib/types'

export interface WireInfo {
  jsonBytes: number
  protobufBytes: number
  json: string
  protobufHex: string
}

export interface OrderState {
  id: string
  customerName?: string
  stage: Stage
  rank: number
  location: TokenLocation
  events: OrderEvent[]
  firstSeen: number
  lastUpdate: number
  /** Momento em que entrou na fila (ordena os tokens FIFO dentro do RabbitMQ). */
  queuedAt?: number
  attempt?: number
  hidden: boolean
  wire?: WireInfo
  grpcLatencyMs?: number
}

export interface Packet {
  id: number
  from: NodeId
  to: NodeId
  tone: Tone
}

export interface ThroughputPoint {
  t: number
  value: number
}

export type Mode = 'live' | 'didactic'
export type Connection = 'connecting' | 'open' | 'error'

interface Durations {
  endToEnd: number[]
  grpc: number[]
  queueWait: number[]
  processing: number[]
}

interface State {
  orders: Record<string, OrderState>
  orderIds: string[]
  log: OrderEvent[]
  packets: Packet[]
  metrics: Metrics | null
  throughput: ThroughputPoint[]
  durations: Durations
  completedSeen: number
  failedSeen: number

  mode: Mode
  pending: OrderEvent[]
  currentStep: OrderEvent | null
  /** Pedido acompanhado no modo didatico (os demais seguem ao vivo). */
  focusOrderId: string | null
  autoplay: boolean

  selectedOrderId: string | null
  selectedNode: NodeId | null
  connection: Connection

  receive: (event: OrderEvent) => void
  receiveMetrics: (metrics: Metrics) => void
  step: () => void
  setMode: (mode: Mode) => void
  setAutoplay: (value: boolean) => void
  removePacket: (id: number) => void
  hideOrder: (id: string) => void
  selectOrder: (id: string | null) => void
  selectNode: (id: NodeId | null) => void
  setConnection: (value: Connection) => void
  clear: () => void
}

const MAX_ORDERS = 250
const MAX_LOG = 150
const MAX_SAMPLES = 50
const THROUGHPUT_WINDOW = 60
const COMPLETED_VISIBLE_MS = 2600

let packetSeq = 0

const pushSample = (list: number[], value: number) =>
  value >= 0 ? [...list.slice(-(MAX_SAMPLES - 1)), value] : list

function firstTimestamp(events: OrderEvent[], stage: Stage, fromEnd = false) {
  const list = fromEnd ? [...events].reverse() : events
  return list.find((e) => e.stage === stage)?.timestamp
}

/** Aplica um evento ao estado (funcao pura, reutilizada pelos modos ao vivo e didatico). */
function apply(state: State, event: OrderEvent): Partial<State> {
  const meta = STAGES[event.stage]
  if (!meta) return {}

  const existing = state.orders[event.orderId]
  const events = [...(existing?.events ?? []), event].sort((a, b) => a.timestamp - b.timestamp)

  let order: OrderState = existing
    ? { ...existing, events, lastUpdate: event.timestamp }
    : {
        id: event.orderId,
        stage: event.stage,
        rank: 0,
        location: 'client',
        events,
        firstSeen: event.timestamp,
        lastUpdate: event.timestamp,
        hidden: false,
      }

  // So move o token para frente (eventos podem chegar fora de ordem); REQUEUED reinicia o ciclo.
  const movesToken =
    meta.location !== null && (event.stage === 'REQUEUED' || meta.rank >= order.rank)
  if (movesToken) {
    order = {
      ...order,
      stage: event.stage,
      rank: meta.rank,
      location: meta.location!,
      hidden: false,
    }
    if (event.stage === 'QUEUED' || event.stage === 'REQUEUED') {
      order.queuedAt = event.timestamp
    }
  }

  const data = event.data ?? {}
  if (typeof data.customerName === 'string') order.customerName = data.customerName
  if (event.stage === 'GRPC_SENT') {
    order.wire = {
      jsonBytes: Number(data.jsonBytes ?? 0),
      protobufBytes: Number(data.protobufBytes ?? 0),
      json: String(data.json ?? ''),
      protobufHex: String(data.protobufHex ?? ''),
    }
    if (!order.customerName && order.wire.json) {
      try {
        order.customerName = JSON.parse(order.wire.json).customerName
      } catch {
        /* ignora */
      }
    }
  }
  if (event.stage === 'GRPC_RESPONDED') order.grpcLatencyMs = Number(data.latencyMs ?? 0)
  if (event.stage === 'RETRY') order.attempt = Number(data.attempt ?? 0) + 1

  const patch: Partial<State> = {}

  // Metricas de duracao por etapa quando o pedido termina
  if (event.stage === 'COMPLETED') {
    const start = firstTimestamp(events, 'CLIENT_RECEIVED')
    const queued = firstTimestamp(events, 'QUEUED', true) ?? firstTimestamp(events, 'REQUEUED', true)
    const picked = firstTimestamp(events, 'WORKER_PICKED', true)
    const d = state.durations
    patch.durations = {
      endToEnd: start ? pushSample(d.endToEnd, event.timestamp - start) : d.endToEnd,
      grpc: order.grpcLatencyMs !== undefined ? pushSample(d.grpc, order.grpcLatencyMs) : d.grpc,
      queueWait: queued && picked ? pushSample(d.queueWait, picked - queued) : d.queueWait,
      processing: picked ? pushSample(d.processing, event.timestamp - picked) : d.processing,
    }
    patch.completedSeen = state.completedSeen + 1
  }
  if (event.stage === 'DEAD_LETTERED') patch.failedSeen = state.failedSeen + 1

  let orderIds = existing ? state.orderIds : [...state.orderIds, order.id]
  let orders = { ...state.orders, [order.id]: order }

  // Limita a memoria: descarta os pedidos mais antigos ja escondidos
  if (orderIds.length > MAX_ORDERS) {
    const removable = orderIds.filter((id) => orders[id]?.hidden).slice(0, orderIds.length - MAX_ORDERS)
    if (removable.length) {
      const drop = new Set(removable)
      orderIds = orderIds.filter((id) => !drop.has(id))
      orders = Object.fromEntries(Object.entries(orders).filter(([id]) => !drop.has(id)))
    }
  }

  const packets = meta.packet
    ? [...state.packets, { id: ++packetSeq, ...meta.packet }]
    : state.packets

  return {
    ...patch,
    orders,
    orderIds,
    packets,
    log: [event, ...state.log].slice(0, MAX_LOG),
  }
}

const emptyDurations: Durations = { endToEnd: [], grpc: [], queueWait: [], processing: [] }

export const useStore = create<State>((set, get) => {
  const scheduleHide = (event: OrderEvent) => {
    if (event.stage === 'COMPLETED') {
      setTimeout(() => get().hideOrder(event.orderId), COMPLETED_VISIBLE_MS)
    }
  }

  const applyNow = (event: OrderEvent) => {
    set((state) => apply(state, event))
    scheduleHide(event)
  }

  return {
    orders: {},
    orderIds: [],
    log: [],
    packets: [],
    metrics: null,
    throughput: [],
    durations: emptyDurations,
    completedSeen: 0,
    failedSeen: 0,

    mode: 'live',
    pending: [],
    currentStep: null,
    focusOrderId: null,
    autoplay: false,

    selectedOrderId: null,
    selectedNode: null,
    connection: 'connecting',

    receive: (event) => {
      if (get().mode === 'didactic') {
        const { focusOrderId } = get()
        const follow =
          event.orderId === focusOrderId || (focusOrderId === null && event.stage === 'CLIENT_RECEIVED')
        if (!follow) {
          applyNow(event)
          return
        }
        set((state) => ({ pending: [...state.pending, event], focusOrderId: event.orderId }))
        // O primeiro evento aparece sozinho; os demais esperam o usuario avancar
        if (!get().currentStep) get().step()
        return
      }
      applyNow(event)
    },

    receiveMetrics: (metrics) =>
      set((state) => {
        const previous = state.metrics?.worker?.completed
        const current = metrics.worker?.completed
        const delta =
          previous !== undefined && current !== undefined ? Math.max(0, current - previous) : 0
        return {
          metrics,
          throughput: [...state.throughput, { t: metrics.timestamp, value: delta }].slice(
            -THROUGHPUT_WINDOW,
          ),
        }
      }),

    step: () => {
      const [next, ...rest] = get().pending
      if (!next) {
        set({ currentStep: null })
        return
      }
      // Ao terminar o pedido acompanhado, o proximo pedido novo passa a ser explicado
      const finished = next.stage === 'COMPLETED' || next.stage === 'DEAD_LETTERED'
      set({ pending: rest, currentStep: next, ...(finished ? { focusOrderId: null } : {}) })
      applyNow(next)
    },

    setMode: (mode) => {
      if (mode === get().mode) return
      if (mode === 'live') {
        const pending = get().pending
        set({ mode, pending: [], currentStep: null, focusOrderId: null, autoplay: false })
        pending.forEach(applyNow)
      } else {
        set({ mode, pending: [], currentStep: null, focusOrderId: null })
      }
    },

    setAutoplay: (autoplay) => set({ autoplay }),

    removePacket: (id) => set((state) => ({ packets: state.packets.filter((p) => p.id !== id) })),

    hideOrder: (id) =>
      set((state) => {
        const order = state.orders[id]
        if (!order || order.stage !== 'COMPLETED') return {}
        return { orders: { ...state.orders, [id]: { ...order, hidden: true } } }
      }),

    selectOrder: (selectedOrderId) => set({ selectedOrderId, selectedNode: null }),
    selectNode: (selectedNode) => set({ selectedNode, selectedOrderId: null }),
    setConnection: (connection) => set({ connection }),

    clear: () =>
      set({
        orders: {},
        orderIds: [],
        log: [],
        packets: [],
        durations: emptyDurations,
        completedSeen: 0,
        failedSeen: 0,
        pending: [],
        currentStep: null,
        focusOrderId: null,
        selectedOrderId: null,
      }),
  }
})

export const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
