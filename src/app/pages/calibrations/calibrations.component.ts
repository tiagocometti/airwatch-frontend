import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CalibrationService } from '../../core/services/calibration.service';
import { DeviceService } from '../../core/services/device.service';
import { DeviceStatusService } from '../../core/services/device-status.service';
import { Calibration, CalibrationProgress } from '../../core/models/calibration.model';

@Component({
  selector: 'app-calibrations',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './calibrations.component.html',
  styleUrl: './calibrations.component.css'
})
export class CalibrationsComponent implements OnInit, OnDestroy {
  deviceId   = signal('');   // UUID usado nas chamadas HTTP
  externalId = signal('');   // ExternalId usado para filtrar eventos SignalR

  activeCalibration  = signal<Calibration | null>(null);
  calibrations       = signal<Calibration[]>([]);
  inProgressCal      = signal<Calibration | null>(null);
  progress           = signal<CalibrationProgress | null>(null);
  tempoRestante      = signal('');

  loading           = signal(true);
  showStartModal    = signal(false);
  showCancelConfirm = signal(false);
  saving            = signal(false);
  error             = signal('');
  startForm: FormGroup;

  private subs: Subscription[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  hasInProgress = computed(() =>
    !!this.inProgressCal() || this.calibrations().some(c => c.status === 'InProgress')
  );

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private calibSvc: CalibrationService,
    private deviceSvc: DeviceService,
    private statusSvc: DeviceStatusService,
    private fb: FormBuilder
  ) {
    this.startForm = this.fb.group({
      location: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  ngOnInit() {
    this.statusSvc.connect();
    const id = this.route.snapshot.paramMap.get('deviceId') ?? '';
    this.deviceId.set(id);

    // ExternalId passado via router state (navegação do sensors.component)
    const navState = this.router.getCurrentNavigation()?.extras?.state
                  ?? history.state;
    const stateExtId: string | undefined = navState?.['externalId'];

    this.subscribeSignalR();   // subscrever ANTES do loadAll para não perder eventos

    if (stateExtId) {
      this.externalId.set(stateExtId);
      this.loadAll();
    } else {
      // fallback: buscar via API
      this.deviceSvc.getAll().subscribe({
        next: devices => {
          const device = devices.find(d => d.id === id);
          if (device) this.externalId.set(device.externalId);
          this.loadAll();
        },
        error: () => this.loadAll()
      });
    }
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.pararTimer();
  }

  loadAll() {
    this.loading.set(true);
    this.calibSvc.getActiveCalibration(this.deviceId()).subscribe({
      next: c => this.activeCalibration.set(c),
      error: () => {}
    });
    this.calibSvc.getCalibrations(this.deviceId()).subscribe({
      next: list => {
        this.calibrations.set(list);
        const inProgress = list.find(c => c.status === 'InProgress') ?? null;
        this.inProgressCal.set(inProgress);
        this.loading.set(false);
        if (inProgress && !this.timerInterval) {
          this.iniciarTimer(inProgress.startedAt, inProgress.duracaoSegundos);
        }
      },
      error: () => this.loading.set(false)
    });
  }

  // ─── Countdown timer ───────────────────────────────────────────────────────

  private iniciarTimer(startedAt: string, duracaoSegundos: number) {
    this.pararTimer();
    const inicio = new Date(startedAt).getTime();
    const tick = () => {
      const elapsed = (Date.now() - inicio) / 1000;
      const remaining = Math.max(0, duracaoSegundos - elapsed);
      const m = Math.floor(remaining / 60).toString().padStart(2, '0');
      const s = Math.floor(remaining % 60).toString().padStart(2, '0');
      this.tempoRestante.set(`${m}:${s}`);
    };
    tick();
    this.timerInterval = setInterval(tick, 1000);
  }

  private pararTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.tempoRestante.set('');
  }

  // ─── Ações ─────────────────────────────────────────────────────────────────

  startCalibration() {
    if (this.startForm.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.calibSvc.startCalibration(this.deviceId(), this.startForm.value.location).subscribe({
      next: () => {
        this.saving.set(false);
        this.showStartModal.set(false);
        this.startForm.reset();
        this.loadAll();
      },
      error: e => {
        this.error.set(e.status === 409 ? 'Já existe uma calibração em andamento.' : 'Erro ao iniciar calibração.');
        this.saving.set(false);
      }
    });
  }

  cancelCalibration() {
    const cal = this.inProgressCal();
    if (!cal) return;
    this.saving.set(true);
    this.calibSvc.cancelCalibration(cal.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.showCancelConfirm.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.showCancelConfirm.set(false);
      }
    });
  }

  activateCalibration(calibrationId: string) {
    this.calibSvc.activateCalibration(calibrationId).subscribe({
      next: () => this.loadAll()
    });
  }

  // ─── SignalR ───────────────────────────────────────────────────────────────

  private subscribeSignalR() {
    const matches = (evDeviceId: string) =>
      evDeviceId === this.externalId() || evDeviceId === this.deviceId();

    this.subs.push(
      this.statusSvc.calibrationStarted$.subscribe(ev => {
        if (matches(ev.deviceId)) {
          this.iniciarTimer(ev.startedAt, ev.duracaoSegundos);
          this.loadAll();
        }
      }),

      this.statusSvc.calibrationProgress$.subscribe(ev => {
        if (matches(ev.deviceId)) {
          this.progress.set(ev);
        }
      }),

      this.statusSvc.calibrationCompleted$.subscribe(ev => {
        if (matches(ev.deviceId)) {
          this.inProgressCal.set(null);
          this.progress.set(null);
          this.pararTimer();
          this.loadAll();
        }
      }),

      this.statusSvc.calibrationFailed$.subscribe(ev => {
        if (matches(ev.deviceId)) {
          this.inProgressCal.set(null);
          this.progress.set(null);
          this.pararTimer();
          this.error.set(`Calibração falhou: ${ev.reason}`);
          this.loadAll();
        }
      }),

      this.statusSvc.calibrationCancelled$.subscribe(ev => {
        if (matches(ev.deviceId)) {
          this.inProgressCal.set(null);
          this.progress.set(null);
          this.pararTimer();
          this.loadAll();
        }
      })
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  formatDate(ts: string): string {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatR0(v?: number): string {
    return v != null ? v.toFixed(0) + ' Ω' : '—';
  }

  statusLabel(s: string): string {
    return { InProgress: 'Em andamento', Completed: 'Concluída', Cancelled: 'Cancelada', Failed: 'Falhou' }[s] ?? s;
  }

  statusClass(s: string): string {
    return { InProgress: 'badge-progress', Completed: 'badge-completed', Cancelled: 'badge-cancelled', Failed: 'badge-failed' }[s] ?? '';
  }
}
