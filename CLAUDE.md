# AirWatch — Frontend

## Stack
- Angular 21
- SignalR (@microsoft/signalr) para eventos em tempo real
- lucide-angular instalado mas não usado diretamente — ícones de nav são SVG inline via DomSanitizer
- Chart.js ainda no package.json mas não é mais usado no dashboard (gráficos substituídos por gauges SVG na view de detalhe)

## Estrutura
```
src/app/
├── core/
│   ├── guards/       # authGuard protege o shell
│   ├── interceptors/ # JWT anexado em todas as requisições autenticadas
│   ├── models/       # Interfaces/tipos TypeScript (device, measurement, calibration, gas-threshold)
│   └── services/     # Serviços de API, SignalR, autenticação, gas-threshold
├── assets/
│   └── icons/
│       └── airwatch-icon.svg   # ícone original; cópia servida em public/
├── layout/
│   ├── shell/        # Wrapper com sidebar + router-outlet
│   └── sidebar/      # Menu lateral retrátil
├── shared/
│   └── gauge/        # GaugeComponent standalone — arco SVG semicircular com 4 zonas coloridas
└── pages/
    ├── login/
    ├── register/
    ├── dashboard/      # Cards de resumo + cards de dispositivos; clicar navega para device-detail
    ├── device-detail/  # Rota /dashboard/devices/:externalId — 4 gauges + subscrição SignalR
    ├── sensors/        # Lista de dispositivos com dot online/offline, gear icon e modal de config
    ├── calibrations/   # Rota /calibrations/:deviceId — 3 seções: calibração ativa, progresso, histórico
    └── measurements/   # Histórico com filtros por dispositivo e período
```

## Assets estáticos
Apenas a pasta `public/` é servida como assets estáticos (configurado em `angular.json`).
- `public/airwatch-icon.svg` — ícone do app usado no login e no sidebar

## Autenticação
- JWT armazenado e enviado via interceptor em todas as requisições
- authGuard protege todas as rotas do shell

## SignalR — eventos recebidos (`DeviceStatusService`, hub `/hubs/device-status`)
- `DeviceStatusChanged` → `statusChanges$` — atualiza status online/offline
- `NewMeasurement` → `newMeasurement$` — nova medição com os quatro PPMs
- `CalibrationStarted` → `calibrationStarted$` — `{ deviceId, calibrationId, startedAt, duracaoSegundos }`
- `CalibrationProgress` → `calibrationProgress$` — `{ deviceId, calibrationId, progressPercent, sampleCount, currentR0Mq3/5/135 }`
- `CalibrationCompleted` → `calibrationCompleted$` — `{ deviceId, calibrationId, r0Mq3/5/135 }`
- `CalibrationFailed` → `calibrationFailed$` — `{ deviceId, calibrationId, reason }`
- `CalibrationCancelled` → `calibrationCancelled$` — `{ deviceId, calibrationId }`

**Atenção:** eventos de calibração usam `deviceId = ExternalId` (ex: `"arduino-01"`), não o UUID interno. O componente de calibrações carrega o `externalId` do router state (passado por `sensors` via `router.navigate(..., { state: { externalId } })`) ou via fallback à API.

## Modelo Calibration
```typescript
interface Calibration {
  id: string;
  deviceId: string;       // UUID interno
  startedAt: string;
  completedAt?: string;
  status: 'InProgress' | 'Completed' | 'Cancelled' | 'Failed';
  location: string;
  r0Mq3?: number;
  r0Mq5?: number;
  r0Mq135?: number;
  sampleCount: number;
  duracaoSegundos: number; // gravado no backend ao criar a sessão
  isActive: boolean;
}
```
Sem campos de CV — coeficiente de variação foi removido do sistema.

## Modelo Measurement
```typescript
interface Measurement {
  id: string;
  deviceId: string;      // ExternalId (ex: "arduino-01")
  timestamp: string;
  mq3Adc: number; mq5Adc: number; mq135Adc: number;
  ppmAlcohol: number;    // MQ-3
  ppmLpg: number;        // MQ-5
  ppmCo2: number;        // MQ-135
  ppmNh3: number;        // MQ-135
}
```

## Gases exibidos
- Álcool — MQ-3 (`ppmAlcohol`)
- GLP — MQ-5 (`ppmLpg`)
- CO₂ — MQ-135 (`ppmCo2`)
- NH₃ — MQ-135 (`ppmNh3`)

## Página Calibrações (`/calibrations/:deviceId`)
- **Seção 1 — Calibração ativa:** exibe R0 MQ-3/5/135 da calibração ativa; avisa se não houver (medições de PPM pausadas)
- **Seção 2 — Progresso:** aparece apenas com sessão `InProgress`; exibe countdown `MM:SS` baseado em `startedAt + duracaoSegundos` (sem constante local — valores vêm do evento `CalibrationStarted` ou do campo `duracaoSegundos` da calibração carregada via API); exibe contagem de amostras e R0 parciais
- **Seção 3 — Histórico:** lista todas as calibrações do dispositivo com status badge e botão "Usar esta" para `Completed` não ativas
- SignalR subscrito **antes** do `loadAll()` para não perder eventos; countdown inicia imediatamente no evento `CalibrationStarted`, sem esperar o reload HTTP

## Sensors page (`/sensors`)
- Gear icon abre modal de configurações (nome e localização do dispositivo via `PATCH /api/devices/:id`)
- Botão "Ver calibrações" navega para `/calibrations/:deviceId` passando `externalId` via router state

## Dashboard (`/dashboard`)
- Banner laranja exibido para cada device com calibração `InProgress`
- Clicar em um card de dispositivo navega para `/dashboard/devices/:externalId`
- SignalR mantido para status online/offline e banners de calibração

## Device Detail (`/dashboard/devices/:externalId`)
- Carrega dispositivo via `GET /api/devices/:externalId` e última medição via `getByDevice(externalId, 1, 1)`
- 4 gauges SVG (CO₂, NH₃, GLP, Álcool) alimentados pelos thresholds do `GasThresholdService`
- Subscreve ao SignalR `newMeasurement$` filtrando pelo `externalId` da rota
- `GasThresholdService` carregado via `APP_INITIALIZER` em `app.config.ts`

## GaugeComponent (`shared/gauge`)
- Arco SVG semicircular (180°) dividido em 4 zonas: verde (Seguro), amarelo-verde (Bom), laranja (Alerta), vermelho (Perigo)
- Agulha animada por CSS `transition: transform 0.6s ease-out` com `transform-origin` no centro do arco
- Max visual do gauge = `alertMax * 1.5`; proporções das zonas determinadas pelos thresholds recebidos via `@Input`

## Sidebar
- Menu lateral retrátil (68px recolhido / 240px expandido) com transição CSS
- Estado controlado por `signal<boolean>` no `SidebarComponent`
- Ícones de nav: SVG string no TypeScript, sanitizados via `DomSanitizer.bypassSecurityTrustHtml()` — obrigatório pois Angular remove SVGs de `innerHTML`
- Visibilidade de texto controlada por CSS (`opacity` + `max-width`/`max-height`) — **não usar `@if (expanded())`** para texto, pois remove elementos sem transição suave
- Ícone do app usa CSS filter: `brightness(0) saturate(100%) invert(68%) sepia(100%) saturate(500%) hue-rotate(157deg) brightness(105%)`

## Convenções
- Lógica de negócio e chamadas HTTP ficam nos services, nunca nos components
- Models TypeScript devem refletir os DTOs do backend — manter sincronizados
- Nomes de eventos SignalR devem ser idênticos aos emitidos pelo backend
- Gráficos Chart.js configurados nos components

## Funcionalidades planejadas (ainda não implementadas)
- Notificações ao usuário para alertas de concentração perigosa
- Ativação/desativação de dispositivos
