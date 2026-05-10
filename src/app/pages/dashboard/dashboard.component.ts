import { Component, OnInit, OnDestroy, signal, computed, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DeviceService } from '../../core/services/device.service';
import { MeasurementService } from '../../core/services/measurement.service';
import { DeviceStatusService } from '../../core/services/device-status.service';
import { Device } from '../../core/models/device.model';
import { Measurement } from '../../core/models/measurement.model';
import { Chart, registerables } from 'chart.js';

// deviceId (ExternalId) → device name for calibration banners
type CalibrationBannerMap = Record<string, string>;

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('realtimeChart') realtimeChartCanvas?: ElementRef<HTMLCanvasElement>;

  loading      = signal(true);
  devices      = signal<Device[]>([]);
  measurements = signal<Measurement[]>([]);

  selectedDeviceId     = signal('');
  realtimeMeasurements = signal<Measurement[]>([]);
  realtimeLoading      = signal(false);

  calibrationBanners = signal<CalibrationBannerMap>({});

  private refreshInterval?: ReturnType<typeof setInterval>;
  private realtimeChart?: Chart;
  private statusSub?: Subscription;
  private newMeasurementSub?: Subscription;
  private calStartedSub?: Subscription;
  private calEndedSub?: Subscription;

  activeDevices    = computed(() => this.devices().filter(d => d.isOnline).length);
  totalMeasurements = computed(() => this.measurements().length);

  lastMeasurementTime = computed(() => {
    const all = this.measurements();
    if (!all.length) return null;
    return all.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b).timestamp;
  });

  selectedDevice = computed(() =>
    this.devices().find(d => d.externalId === this.selectedDeviceId()) ?? null
  );

  latestReading = computed(() => {
    const rt = this.realtimeMeasurements();
    if (!rt.length) return null;
    return rt.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b);
  });

  constructor(
    private deviceSvc: DeviceService,
    private measurementSvc: MeasurementService,
    private deviceStatusSvc: DeviceStatusService,
    private router: Router
  ) {
    effect(() => {
      this.realtimeMeasurements();
      setTimeout(() => this.renderRealtimeChart(), 0);
    });
  }

  ngOnInit() {
    this.deviceStatusSvc.connect();

    this.statusSub = this.deviceStatusSvc.statusChanges$.subscribe(({ deviceId, isOnline, lastSeen }) => {
      this.devices.update(list =>
        list.map(d => d.externalId === deviceId ? { ...d, isOnline, lastSeen } : d)
      );
    });

    this.newMeasurementSub = this.deviceStatusSvc.newMeasurement$.subscribe(m => {
      if (m.deviceId === this.selectedDeviceId()) {
        this.realtimeMeasurements.update(list => [...list, m]);
      }
    });

    this.calStartedSub = this.deviceStatusSvc.calibrationStarted$.subscribe(ev => {
      const device = this.devices().find(d => d.externalId === ev.deviceId);
      const name = device?.name ?? ev.deviceId;
      this.calibrationBanners.update(m => ({ ...m, [ev.deviceId]: name }));
    });

    const removeBanner = (deviceId: string) => {
      this.calibrationBanners.update(m => {
        const copy = { ...m };
        delete copy[deviceId];
        return copy;
      });
    };

    this.calEndedSub = new Subscription();
    this.calEndedSub.add(this.deviceStatusSvc.calibrationCompleted$.subscribe(ev => removeBanner(ev.deviceId)));
    this.calEndedSub.add(this.deviceStatusSvc.calibrationFailed$.subscribe(ev => removeBanner(ev.deviceId)));
    this.calEndedSub.add(this.deviceStatusSvc.calibrationCancelled$.subscribe(ev => removeBanner(ev.deviceId)));

    this.loadData();
    this.refreshInterval = setInterval(() => this.loadData(), 30000);
  }

  ngOnDestroy() {
    this.statusSub?.unsubscribe();
    this.newMeasurementSub?.unsubscribe();
    this.calStartedSub?.unsubscribe();
    this.calEndedSub?.unsubscribe();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.realtimeChart?.destroy();
  }

  loadData() {
    this.loading.set(true);
    this.deviceSvc.getAll().subscribe({
      next: devices => {
        this.devices.set(devices);
        this.measurementSvc.getLatest(1, 50).subscribe({
          next: result => {
            this.measurements.set(result.items);
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  goToRegisterDevice() {
    this.router.navigate(['/sensors'], { queryParams: { openModal: true } });
  }

  selectDevice(externalId: string) {
    if (this.selectedDeviceId() === externalId) {
      this.closeRealtime();
      return;
    }

    this.selectedDeviceId.set(externalId);
    this.realtimeMeasurements.set([]);
    this.realtimeChart?.destroy();
    this.realtimeChart = undefined;

    // Carrega histórico recente para popular o gráfico imediatamente
    this.realtimeLoading.set(true);
    this.measurementSvc.getByDevice(externalId, 1, 30).subscribe({
      next: result => {
        this.realtimeMeasurements.set([...result.items].reverse());
        this.realtimeLoading.set(false);
      },
      error: () => this.realtimeLoading.set(false)
    });
  }

  closeRealtime() {
    this.selectedDeviceId.set('');
    this.realtimeMeasurements.set([]);
    this.realtimeChart?.destroy();
    this.realtimeChart = undefined;
  }

  private renderRealtimeChart() {
    if (!this.realtimeChartCanvas) return;
    const items = this.realtimeMeasurements();
    if (!items.length) { this.realtimeChart?.destroy(); this.realtimeChart = undefined; return; }

    const labels = items.map(m =>
      new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );

    this.realtimeChart?.destroy();
    const ctx = this.realtimeChartCanvas.nativeElement.getContext('2d')!;
    this.realtimeChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Álcool (ppm)', data: items.map(m => m.ppmAlcohol), borderColor: '#00d4ff', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 3 },
          { label: 'GLP (ppm)',    data: items.map(m => m.ppmLpg),     borderColor: '#ff9800', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 3 },
          { label: 'CO₂ (ppm)',    data: items.map(m => m.ppmCo2),     borderColor: '#00e676', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 3 },
          { label: 'NH₃ (ppm)',    data: items.map(m => m.ppmNh3),     borderColor: '#ff4081', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 3 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: true, labels: { color: '#6a8fa8', font: { size: 11 }, boxWidth: 10, padding: 15 } },
          tooltip: { backgroundColor: '#0d1424', borderColor: 'rgba(0,212,255,0.2)', borderWidth: 1, titleColor: '#e2eef5', bodyColor: '#6a8fa8', padding: 10 }
        },
        scales: {
          x: { ticks: { color: '#334d61', font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: 'rgba(0,212,255,0.04)' } },
          y: { title: { display: true, text: 'ppm', color: '#6a8fa8', font: { size: 10 } }, ticks: { color: '#334d61', font: { size: 10 } }, grid: { color: 'rgba(0,212,255,0.04)' } }
        }
      }
    });
  }

  formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  formatLastMeasurement(timestamp: string | null): string {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
