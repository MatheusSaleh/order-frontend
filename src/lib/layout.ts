import type { Tone } from './stages'
import type { NodeId } from './types'

/** Dimensoes "de projeto" do diagrama; o canvas e escalado para a largura disponivel. */
export const CANVAS_WIDTH = 1200
export const CANVAS_HEIGHT = 480

export interface NodeSpec {
  x: number
  y: number
  w: number
  h: number
  title: string
  subtitle: string
  tone: Tone
  role: string
  description: string
  why: string
  tech: string[]
}

export const NODES: Record<NodeId, NodeSpec> = {
  browser: {
    x: 88, y: 245, w: 136, h: 100,
    title: 'Navegador', subtitle: 'React + SSE', tone: 'slate',
    role: 'Interface',
    description:
      'Esta página. Envia pedidos via REST e recebe, em tempo real, cada evento do ciclo de vida do pedido por Server-Sent Events.',
    why: 'Navegadores não falam gRPC nativo nem AMQP. Por isso o front conversa só com o gateway, usando HTTP e SSE.',
    tech: ['React 19', 'TypeScript', 'Motion', 'EventSource (SSE)'],
  },
  client: {
    x: 300, y: 245, w: 150, h: 110,
    title: 'order-client', subtitle: 'API Gateway', tone: 'sky',
    role: 'Gateway REST → gRPC',
    description:
      'Recebe JSON via REST, converte para Protobuf e chama o order-server via gRPC. Também assina o exchange order.events e repassa os eventos ao navegador por SSE.',
    why: 'Isola o mundo externo (HTTP/JSON) do mundo interno (gRPC/Protobuf), que é mais rápido e fortemente tipado.',
    tech: ['Spring Boot 4.2', 'gRPC client starter', 'SSE', 'Virtual Threads'],
  },
  server: {
    x: 550, y: 245, w: 150, h: 110,
    title: 'order-server', subtitle: 'Servidor gRPC', tone: 'violet',
    role: 'Serviço de pedidos',
    description:
      'Implementa o OrderService definido no grpc-commons. Persiste o pedido como PENDING no MongoDB e publica a mensagem na fila do RabbitMQ.',
    why: 'Persistir antes de enfileirar garante que nenhum pedido aceito se perca, mesmo que o broker falhe logo em seguida.',
    tech: ['Spring Boot 4.2', 'gRPC server starter', 'Validação de entrada', 'Spring AMQP'],
  },
  queue: {
    x: 820, y: 245, w: 200, h: 110,
    title: 'RabbitMQ', subtitle: 'pedidos_fila', tone: 'amber',
    role: 'Message broker',
    description:
      'Fila durável que desacopla quem recebe pedidos de quem os processa. Mensagens rejeitadas são encaminhadas automaticamente para a DLQ (dead-letter exchange).',
    why: 'A fila absorve picos: se chegarem 50 pedidos de uma vez, eles esperam em segurança enquanto o worker processa no seu ritmo.',
    tech: ['RabbitMQ 4', 'Fila durável', 'Dead-letter exchange', 'JSON'],
  },
  worker: {
    x: 1070, y: 245, w: 150, h: 110,
    title: 'order-worker', subtitle: 'Consumidor', tone: 'emerald',
    role: 'Processamento assíncrono',
    description:
      'Consome um pedido por vez (prefetch = 1), simula o processamento, faz até 3 tentativas com backoff e atualiza o status no MongoDB.',
    why: 'Para escalar, bastaria subir mais réplicas do worker: o RabbitMQ distribui as mensagens entre elas.',
    tech: ['Spring Boot 4.2', '@RabbitListener', 'Retry + backoff', 'MongoTemplate'],
  },
  mongo: {
    x: 820, y: 405, w: 190, h: 100,
    title: 'MongoDB', subtitle: 'orderdb.orders', tone: 'green',
    role: 'Banco de dados',
    description:
      'Guarda o documento de cada pedido. O order-server cria com status PENDING; o worker atualiza para PROCESSING, COMPLETED ou FAILED.',
    why: 'É a fonte da verdade consultada pelo gRPC GetOrderStatus, independente de onde o pedido esteja no fluxo.',
    tech: ['MongoDB 8', 'Spring Data MongoDB', 'Usuário com acesso mínimo'],
  },
  dlq: {
    x: 820, y: 80, w: 190, h: 96,
    title: 'Dead Letter Queue', subtitle: 'pedidos_fila.dlq', tone: 'rose',
    role: 'Pedidos com falha',
    description:
      'Recebe as mensagens que falharam em todas as tentativas. Elas podem ser analisadas e reprocessadas (redrive) pelo simulador.',
    why: 'Sem DLQ, uma mensagem problemática poderia travar a fila ou ser descartada silenciosamente.',
    tech: ['x-dead-letter-exchange', 'Redrive manual'],
  },
}

export interface EdgeSpec {
  from: NodeId
  to: NodeId
  label: string
}

export const EDGES: EdgeSpec[] = [
  { from: 'browser', to: 'client', label: 'HTTP · JSON' },
  { from: 'client', to: 'server', label: 'gRPC · Protobuf' },
  { from: 'server', to: 'queue', label: 'publish' },
  { from: 'queue', to: 'worker', label: 'consume' },
  { from: 'server', to: 'mongo', label: 'insert' },
  { from: 'worker', to: 'mongo', label: 'update' },
  { from: 'queue', to: 'dlq', label: 'dead-letter' },
]

/** Onde os tokens de cada local ficam e quantos cabem antes de mostrar "+N". */
export const SLOTS: Record<string, { x: number; y: number; spacing: number; max: number; reverse?: boolean }> = {
  client: { x: 300, y: 258, spacing: 22, max: 5 },
  server: { x: 550, y: 258, spacing: 22, max: 5 },
  wire: { x: 425, y: 254, spacing: 22, max: 3 },
  // FIFO: o pedido mais antigo fica a direita, mais perto do worker
  queue: { x: 820, y: 258, spacing: 21, max: 9, reverse: true },
  worker: { x: 1070, y: 258, spacing: 22, max: 3 },
  mongo: { x: 820, y: 418, spacing: 22, max: 7 },
  dlq: { x: 820, y: 92, spacing: 21, max: 8 },
  browser: { x: 88, y: 245, spacing: 22, max: 1 },
}

export function slotPosition(location: string, index: number, count: number) {
  const slot = SLOTS[location]
  const visible = Math.min(count, slot.max)
  const offset = (index - (visible - 1) / 2) * slot.spacing
  return { x: slot.x + (slot.reverse ? -offset : offset), y: slot.y }
}
