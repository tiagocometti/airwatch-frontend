# AirWatch — Frontend

## Stack
- Angular 21
- Chart.js para gráficos de leituras em tempo real
- SignalR (@microsoft/signalr) para status online/offline em tempo real
- lucide-angular para ícones

## Estrutura
```
src/app/
├── core/
│   ├── guards/       # authGuard protege o shell
│   ├── interceptors/ # JWT anexado em todas as requisições autenticadas
│   ├── models/       # Interfaces/tipos TypeScript
│   └── services/     # Serviços de API, SignalR, autenticação
└── pages/
    ├── login/
    ├── register/
    ├── dashboard/    # Cards de resumo, status online/offline, gráfico em tempo real
    ├── sensors/      # Listagem e cadastro de dispositivos
    └── measurements/ # Histórico com filtros por dispositivo, sensor e período
```

## Autenticação
- JWT armazenado e enviado via interceptor em todas as requisições
- authGuard protege todas as rotas do shell

## SignalR
Usado para receber eventos em tempo real do backend:
- Status online/offline dos dispositivos no dashboard
- Novos dados de leitura para atualização do gráfico em tempo real

## Sensores exibidos
- MQ3 — álcool (ppm)
- MQ5 — GLP/gás natural (ppm)
- MQ135 — qualidade geral do ar (ppm)

## Convenções
- Lógica de negócio e chamadas HTTP ficam nos services, nunca nos components
- Models TypeScript devem refletir os DTOs do backend — manter sincronizados
- Gráficos Chart.js configurados nos components de dashboard — preferir encapsular em componente dedicado se crescer
- Nomes de eventos SignalR devem ser idênticos aos emitidos pelo backend

## Funcionalidades planejadas (ainda não implementadas)
- Tela/fluxo de calibração remota de sensores (definição ainda em aberto)
- Notificações ao usuário para alertas de concentração perigosa
- Ativação/desativação de dispositivos
- Comandos remotos ao Arduino via interface web