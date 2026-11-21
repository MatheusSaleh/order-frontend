import type { OrderItemInput, OrderStatus, Product, WorkerStatus } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      detail = body.detail ?? body.error ?? detail
    } catch {
      /* corpo vazio */
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export const api = {
  catalog: () => request<Product[]>('/api/catalog'),

  placeOrder: (customerName: string, items: OrderItemInput[]) =>
    request<{ orderId: string; status: string; message: string }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ customerName, items, timestamp: new Date().toISOString() }),
    }),

  orderStatus: (orderId: string) => request<OrderStatus>(`/api/orders/${encodeURIComponent(orderId)}`),

  burst: (count: number) =>
    request<{ accepted: number }>('/api/simulation/burst', {
      method: 'POST',
      body: JSON.stringify({ count }),
    }),

  updateWorker: (changes: Partial<Pick<WorkerStatus, 'running' | 'failureRate' | 'processingDelayMs'>>) =>
    request<WorkerStatus>('/api/simulation/worker', {
      method: 'PUT',
      body: JSON.stringify(changes),
    }),

  redriveDlq: () => request<{ requeued: number }>('/api/simulation/dlq/redrive', { method: 'POST' }),
}
