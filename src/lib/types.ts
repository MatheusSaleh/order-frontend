export type Stage =
  | 'CLIENT_RECEIVED'
  | 'GRPC_SENT'
  | 'SERVER_RECEIVED'
  | 'SAVED_PENDING'
  | 'QUEUED'
  | 'GRPC_RESPONDED'
  | 'WORKER_PICKED'
  | 'PROCESSING'
  | 'RETRY'
  | 'COMPLETED'
  | 'DEAD_LETTERED'
  | 'REQUEUED'

export type ServiceName = 'order-client' | 'order-server' | 'order-worker'

export interface OrderEvent {
  orderId: string
  stage: Stage
  service: ServiceName
  timestamp: number
  message: string
  data: Record<string, unknown>
}

export interface WorkerStatus {
  running: boolean
  failureRate: number
  processingDelayMs: number
  maxAttempts: number
  completed: number
  failed: number
}

export interface Metrics {
  timestamp: number
  queueDepth: number
  dlqDepth: number
  worker: WorkerStatus | null
}

export interface Product {
  id: string
  name: string
  price: number
  emoji: string
}

export interface OrderItemInput {
  productId: string
  productName: string
  quantity: number
  price: number
}

export interface OrderStatus {
  orderId: string
  status: string
  customerName: string
  totalAmount: number
  lastUpdated: string
  items: OrderItemInput[]
}

export type NodeId = 'browser' | 'client' | 'server' | 'queue' | 'worker' | 'mongo' | 'dlq'
