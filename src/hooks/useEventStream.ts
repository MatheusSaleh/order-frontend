import { useEffect } from 'react'
import { useStore } from '../state/store'
import type { Metrics, OrderEvent } from '../lib/types'

/**
 * Conecta ao SSE do order-client. O EventSource reconecta sozinho se a conexao cair
 * (ex.: enquanto os containers ainda estao subindo).
 */
export function useEventStream() {
  useEffect(() => {
    const { receive, receiveMetrics, setConnection } = useStore.getState()
    const source = new EventSource('/api/events/stream')

    source.addEventListener('connected', () => setConnection('open'))
    source.addEventListener('order-event', (e) => {
      receive(JSON.parse((e as MessageEvent).data) as OrderEvent)
    })
    source.addEventListener('metrics', (e) => {
      setConnection('open')
      receiveMetrics(JSON.parse((e as MessageEvent).data) as Metrics)
    })
    source.onerror = () => setConnection(source.readyState === EventSource.CLOSED ? 'error' : 'connecting')

    return () => source.close()
  }, [])
}
