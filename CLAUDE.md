# AirWatch — Frontend

## Stack
- Angular 21
- Chart.js para gráficos de leituras em tempo real
- SignalR (@microsoft/signalr) para status online/offline e novas medições em tempo real
- lucide-angular para ícones (instalado mas não utilizado diretamente — ícones do sidebar são SVG inline via DomSanitizer)

## Estrutura
```
src/app/
├── core/
│   ├── guards/       # authGuard protege o shell
│   ├── interceptors/ # JWT anexado em todas as requisições autenticadas
│   ├── models/       # Interfaces/tipos TypeScript
│   └── services/     # Serviços de API, SignalR, autenticação
├── assets/
│   └── icons/
│       └── airwatch-icon.svg   # ícone original (fonte); cópia servida em public/
├── layout/
│   ├── shell/        # Wrapper com sidebar + router-outlet
│   └── sidebar/      # Menu lateral retrátil
└── pages/
    ├── login/
    ├── register/
    ├── dashboard/    # Cards de resumo, status online/offline, gráfico em tempo real via SignalR
    ├── sensors/      # Listagem e cadastro de dispositivos
    └── measurements/ # Histórico com filtros por dispositivo e período
```

## Assets estáticos
Apenas a pasta `public/` é servida como assets estáticos (configurado em `angular.json`).
- `public/airwatch-icon.svg` — ícone do app usado no login e no sidebar

## Autenticação
- JWT armazenado e enviado via interceptor em todas as requisições
- authGuard protege todas as rotas do shell

## SignalR — eventos recebidos
Ambos os eventos chegam pelo hub `/hubs/device-status` via `DeviceStatusService`:
- `DeviceStatusChanged` → `statusChanges$` — atualiza status online/offline dos dispositivos
- `NewMeasurement` → `newMeasurement$` — nova medição com os quatro PPMs; usada pelo dashboard para tempo real

## Modelo Measurement
```typescript
interface Measurement {
  id: string;
  deviceId: string;      // ExternalId do dispositivo (ex: "arduino-01")
  timestamp: string;
  mq3Adc: number;
  mq5Adc: number;
  mq135Adc: number;
  ppmAlcohol: number;    // MQ-3
  ppmLpg: number;        // MQ-5
  ppmCo2: number;        // MQ-135
  ppmNh3: number;        // MQ-135
}
```
Cada objeto representa um ciclo completo de leitura (todos os sensores num mesmo timestamp).

## Gases exibidos
- Álcool — MQ-3 (`ppmAlcohol`)
- GLP — MQ-5 (`ppmLpg`)
- CO₂ — MQ-135 (`ppmCo2`)
- NH₃ — MQ-135 (`ppmNh3`)

## Dashboard — tempo real
- Ao selecionar um dispositivo, carrega histórico recente via `getByDevice()` e depois recebe novas medições pelo evento SignalR `NewMeasurement` (filtrando por `deviceId`)
- Não há mais polling por intervalo para medições em tempo real
- Gráfico exibe 4 datasets (Álcool, GLP, CO₂, NH₃) × tempo
- Cards de última leitura exibem PPM e ADC de cada gás

## Medições (página histórico)
- Filtros: dispositivo e intervalo de data — **sem filtro por tipo de sensor**
- Tabela: Dispositivo, Data/Hora, Álcool (ppm), GLP (ppm), CO₂ (ppm), NH₃ (ppm)
- Gráfico: 4 linhas (uma por gás) sobre o mesmo eixo de tempo

## Sidebar
- Menu lateral retrátil (68px recolhido / 240px expandido) com transição CSS
- Estado controlado por `signal<boolean>` no `SidebarComponent`
- Ícones dos itens de nav definidos como SVG string no TypeScript e sanitizados via `DomSanitizer.bypassSecurityTrustHtml()` — obrigatório porque Angular sanitiza `innerHTML` e remove SVGs por padrão
- Visibilidade do texto e labels controlada por CSS (`opacity` + `max-width`/`max-height`) — **não usar `@if (expanded())`** para texto, pois remove elementos do DOM sem transição suave
- Header usa `flex-direction: column` no estado recolhido para empilhar logo + botão toggle verticalmente e evitar que o botão seja cortado pelo `overflow: hidden` do sidebar
- Ícone do app (`.logo-img`) usa CSS filter para converter o SVG preto em `#00d4ff`:
  `brightness(0) saturate(100%) invert(68%) sepia(100%) saturate(500%) hue-rotate(157deg) brightness(105%)`

## Convenções
- Lógica de negócio e chamadas HTTP ficam nos services, nunca nos components
- Models TypeScript devem refletir os DTOs do backend — manter sincronizados
- Gráficos Chart.js configurados nos components — preferir encapsular em componente dedicado se crescer
- Nomes de eventos SignalR devem ser idênticos aos emitidos pelo backend

## Funcionalidades planejadas (ainda não implementadas)
- Notificações ao usuário para alertas de concentração perigosa
- Ativação/desativação de dispositivos
- Comandos remotos ao Arduino via interface web
- Tela de gerenciamento de calibração de R0 (definição em aberto)
