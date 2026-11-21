# order-frontend

Visualização interativa e animada da plataforma de pedidos. Visão geral e como rodar tudo: **[order-platform](https://github.com/MatheusSaleh/order-platform)**.

![Demonstração da interface](https://raw.githubusercontent.com/MatheusSaleh/order-platform/main/docs/demo.gif)

| Modo didático | Falhas e DLQ |
|---|---|
| ![Modo didático](https://raw.githubusercontent.com/MatheusSaleh/order-platform/main/docs/didactic.png) | ![Falhas e DLQ](https://raw.githubusercontent.com/MatheusSaleh/order-platform/main/docs/failures-dlq.png) |

## Recursos

- **Pipeline ao vivo:** cada pedido é uma bolinha que percorre os serviços conforme os eventos chegam via SSE
- **Modo didático:** acompanha um pedido etapa por etapa, com explicações, trilha de progresso e comparação JSON x Protobuf com os bytes reais
- **Simulador:** rajadas de pedidos, ligar/desligar o worker, taxa de falha, tempo de processamento e redrive da DLQ
- **Métricas:** throughput (últimos 60 s), latência gRPC, tempo ponta a ponta e onde o tempo é gasto (gRPC × fila × processamento)
- **Detalhes:** linha do tempo de cada pedido com consulta gRPC ao MongoDB, e explicação de arquitetura de cada serviço

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Motion · Zustand · lucide-react

## Desenvolvimento

Com o backend rodando (`docker compose up` no order-platform):

```bash
npm install
npm run dev     # http://localhost:5173 (proxy de /api para localhost:8080)
```

Em produção o app é servido por nginx 1.30 (Alpine, sem root, sistema de arquivos somente leitura), que faz proxy de `/api` para o order-client. O nginx aplica rate limit por IP, limita o tamanho do corpo e as conexões SSE por IP, e envia cabeçalhos de segurança (CSP, `X-Frame-Options`...). Veja [`nginx.conf`](nginx.conf) e [`security-headers.conf`](security-headers.conf).

## Estrutura

```
src/
├── lib/          tipos, cliente da API, metadados das etapas e layout do diagrama
├── state/        store (Zustand): aplica eventos, modo didático e métricas
├── hooks/        conexão SSE
└── components/   PipelineCanvas, ServiceNode, ControlPanel, MetricsPanel, EventLog, DidacticPanel...
```
