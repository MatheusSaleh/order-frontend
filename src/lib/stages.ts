import type { NodeId, Stage } from './types'

/** Onde o "token" do pedido fica no diagrama. 'wire' = trafegando entre client e server. */
export type TokenLocation = NodeId | 'wire'

export interface StageMeta {
  label: string
  /** Posicao do token; null = evento informativo que nao move o token. */
  location: TokenLocation | null
  /** Ordem logica: eventos atrasados com rank menor nao fazem o token voltar. */
  rank: number
  tone: Tone
  /** Pacote animado disparado pelo evento (ex.: escrita no MongoDB). */
  packet?: { from: NodeId; to: NodeId; tone: Tone }
  /** Nos e conexoes destacados no modo didatico. */
  focus: NodeId[]
  title: string
  explanation: string
}

export type Tone = 'sky' | 'violet' | 'amber' | 'emerald' | 'yellow' | 'green' | 'rose' | 'slate'

export const STAGES: Record<Stage, StageMeta> = {
  CLIENT_RECEIVED: {
    label: 'Recebido (REST)',
    location: 'client',
    rank: 1,
    tone: 'sky',
    packet: { from: 'browser', to: 'client', tone: 'sky' },
    focus: ['browser', 'client'],
    title: 'A requisição REST chega ao gateway',
    explanation:
      'O navegador envia o pedido como JSON via HTTP POST /api/orders. O order-client faz o papel de API Gateway: valida o payload e gera um ID para rastrear o pedido de ponta a ponta.',
  },
  GRPC_SENT: {
    label: 'gRPC enviado',
    location: 'wire',
    rank: 2,
    tone: 'sky',
    focus: ['client', 'server'],
    title: 'JSON vira Protobuf e viaja via gRPC',
    explanation:
      'O gateway converte o JSON em uma mensagem Protobuf (binária, tipada pelo contrato .proto do grpc-commons) e chama o método PlaceOrder do order-server sobre HTTP/2. Compare o tamanho dos dois formatos abaixo.',
  },
  SERVER_RECEIVED: {
    label: 'Servidor recebeu',
    location: 'server',
    rank: 3,
    tone: 'violet',
    focus: ['server'],
    title: 'O servidor gRPC recebe a chamada',
    explanation:
      'O order-server implementa o serviço OrderService gerado a partir do mesmo .proto. Como cliente e servidor compartilham o contrato, os dois falam exatamente a mesma língua, e qualquer incompatibilidade aparece em tempo de compilação.',
  },
  SAVED_PENDING: {
    label: 'Salvo (PENDING)',
    location: 'server',
    rank: 4,
    tone: 'violet',
    packet: { from: 'server', to: 'mongo', tone: 'green' },
    focus: ['server', 'mongo'],
    title: 'Persistir antes de tudo',
    explanation:
      'O pedido é gravado no MongoDB com status PENDING antes de ir para a fila. Assim, mesmo que algo falhe depois, o pedido nunca se perde e pode ser consultado a qualquer momento.',
  },
  QUEUED: {
    label: 'Na fila',
    location: 'queue',
    rank: 5,
    tone: 'amber',
    focus: ['server', 'queue'],
    title: 'Publicado na fila do RabbitMQ',
    explanation:
      'Em vez de processar na hora, o servidor publica o pedido na fila pedidos_fila. Isso é processamento assíncrono: quem produz e quem consome trabalham no seu próprio ritmo, e a fila absorve os picos.',
  },
  GRPC_RESPONDED: {
    label: 'Resposta gRPC',
    location: null,
    rank: 0,
    tone: 'sky',
    packet: { from: 'server', to: 'client', tone: 'sky' },
    focus: ['server', 'client'],
    title: 'Resposta rápida ao cliente',
    explanation:
      'O order-server responde RECEIVED em poucos milissegundos, mesmo com o pedido ainda na fila. O usuário não precisa esperar o processamento pesado terminar.',
  },
  WORKER_PICKED: {
    label: 'Worker consumiu',
    location: 'worker',
    rank: 6,
    tone: 'emerald',
    focus: ['queue', 'worker'],
    title: 'O worker consome a fila',
    explanation:
      'O order-worker escuta a fila e retira um pedido por vez (prefetch = 1). Se chegarem muitos pedidos, eles esperam na fila em segurança, sem sobrecarregar nenhum serviço.',
  },
  PROCESSING: {
    label: 'Processando',
    location: 'worker',
    rank: 7,
    tone: 'emerald',
    packet: { from: 'worker', to: 'mongo', tone: 'green' },
    focus: ['worker', 'mongo'],
    title: 'Processamento',
    explanation:
      'Aqui entraria a regra de negócio real: reservar estoque, cobrar o pagamento, emitir a nota. O status no MongoDB muda para PROCESSING.',
  },
  RETRY: {
    label: 'Nova tentativa',
    location: 'worker',
    rank: 7,
    tone: 'yellow',
    focus: ['worker'],
    title: 'Falhou? Tenta de novo',
    explanation:
      'Falhas temporárias acontecem: um serviço externo fora do ar, um timeout. O worker tenta novamente com espera crescente (backoff) antes de desistir.',
  },
  COMPLETED: {
    label: 'Concluído',
    location: 'mongo',
    rank: 9,
    tone: 'green',
    focus: ['worker', 'mongo'],
    title: 'Pedido concluído!',
    explanation:
      'O worker atualiza o pedido para COMPLETED no MongoDB. Agora GET /api/orders/{id}, que chama o gRPC GetOrderStatus, mostra o status final.',
  },
  DEAD_LETTERED: {
    label: 'Enviado à DLQ',
    location: 'dlq',
    rank: 9,
    tone: 'rose',
    focus: ['worker', 'queue', 'dlq'],
    title: 'Dead Letter Queue',
    explanation:
      'Depois de esgotar as tentativas, a mensagem é rejeitada e o RabbitMQ a move para pedidos_fila.dlq. Nada se perde: os pedidos podem ser analisados e reprocessados depois.',
  },
  REQUEUED: {
    label: 'Reprocessando',
    location: 'queue',
    rank: 5,
    tone: 'amber',
    packet: { from: 'dlq', to: 'queue', tone: 'amber' },
    focus: ['dlq', 'queue'],
    title: 'Redrive da DLQ',
    explanation:
      'O pedido saiu da DLQ e voltou para a fila principal para uma nova tentativa. É o "redrive", feito normalmente depois de corrigir a causa da falha.',
  },
}

export const TONE_CLASSES: Record<Tone, { dot: string; text: string; ring: string; bg: string }> = {
  sky: { dot: 'bg-sky-400', text: 'text-sky-300', ring: 'ring-sky-400/60', bg: 'bg-sky-400/10' },
  violet: { dot: 'bg-violet-400', text: 'text-violet-300', ring: 'ring-violet-400/60', bg: 'bg-violet-400/10' },
  amber: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-400/60', bg: 'bg-amber-400/10' },
  emerald: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/60', bg: 'bg-emerald-400/10' },
  yellow: { dot: 'bg-yellow-300', text: 'text-yellow-200', ring: 'ring-yellow-300/60', bg: 'bg-yellow-300/10' },
  green: { dot: 'bg-green-400', text: 'text-green-300', ring: 'ring-green-400/60', bg: 'bg-green-400/10' },
  rose: { dot: 'bg-rose-400', text: 'text-rose-300', ring: 'ring-rose-400/60', bg: 'bg-rose-400/10' },
  slate: { dot: 'bg-slate-400', text: 'text-slate-300', ring: 'ring-slate-400/60', bg: 'bg-slate-400/10' },
}

export const TONE_HEX: Record<Tone, string> = {
  sky: '#38bdf8',
  violet: '#a78bfa',
  amber: '#fbbf24',
  emerald: '#34d399',
  yellow: '#fde047',
  green: '#4ade80',
  rose: '#fb7185',
  slate: '#94a3b8',
}

export const SERVICE_TONE: Record<string, Tone> = {
  'order-client': 'sky',
  'order-server': 'violet',
  'order-worker': 'emerald',
}
