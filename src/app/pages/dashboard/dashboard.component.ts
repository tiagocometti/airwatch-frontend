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

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('realtimeChart') realtimeChartCanvas?: ElementRef<HTMLCanvasElement>;

  loading = signal(true);
  devices = signal<Device[]>([]);
  measurements = signal<Measurement[]>([]);

  selectedDeviceId = signal('');
  clickTime = signal<Date | null>(null);
  realtimeMeasurements = signal<Measurement[]>([]);
  realtimeLoading = signal(false);

  private refreshInterval?: ReturnType<typeof setInterval>;
  private realtimeInterval?: ReturnType<typeof setInterval>;
  private realtimeChart?: Chart;
  private statusSub?: Subscription;

  activeDevices = computed(() => this.devices().filter(d => d.isOnline).length);
  totalMeasurements = computed(() => this.measurements().length);

  lastMeasurementTime = computed(() => {
    const all = this.measurements();
    if (!all.length) return null;
    return all.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b).timestamp;
  });

  selectedDevice = computed(() =>
    this.devices().find(d => d.externalId === this.selectedDeviceId()) ?? null
  );

  isCalibrating = computed(() => {
    const rt = this.realtimeMeasurements();
    if (rt.length === 0) return false;
    const latest = rt.reduce((a, b) =>
      new Date(a.timestamp) > new Date(b.timestamp) ? a : b
    );
    return !latest.calibrated;
  });

  realtimeBySensor = computed(() => {
    const result: Record<string, Measurement> = {};
    for (const m of this.realtimeMeasurements()) {
      const existing = result[m.sensorType];
      if (!existing || new Date(m.timestamp) > new Date(existing.timestamp)) {
        result[m.sensorType] = m;
      }
    }
    return result;
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

    this.loadData();
    this.refreshInterval = setInterval(() => this.loadData(), 30000);
  }

  ngOnDestroy() {
    this.statusSub?.unsubscribe();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.realtimeInterval) clearInterval(this.realtimeInterval);
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
    this.clickTime.set(new Date());
    this.realtimeMeasurements.set([]);
    this.realtimeChart?.destroy();
    this.realtimeChart = undefined;

    if (this.realtimeInterval) clearInterval(this.realtimeInterval);
    this.pollRealtime(externalId);
    this.realtimeInterval = setInterval(() => this.pollRealtime(externalId), 5000);
  }

  closeRealtime() {
    this.selectedDeviceId.set('');
    this.clickTime.set(null);
    this.realtimeMeasurements.set([]);
    this.realtimeChart?.destroy();
    this.realtimeChart = undefined;
    if (this.realtimeInterval) clearInterval(this.realtimeInterval);
  }

  private pollRealtime(deviceId: string) {
    const startTime = this.clickTime();
    if (!startTime) return;

    this.realtimeLoading.set(true);
    this.measurementSvc.getByDevice(deviceId, undefined, 1, 200).subscribe({
      next: result => {
        const filtered = result.items.filter(m => new Date(m.timestamp) >= startTime);
        this.realtimeMeasurements.set(filtered);
        this.realtimeLoading.set(false);
      },
      error: () => this.realtimeLoading.set(false)
    });
  }

  private renderRealtimeChart() {
    if (!this.realtimeChartCanvas) return;
    const items = this.realtimeMeasurements();
    if (items.length === 0) { this.realtimeChart?.destroy(); this.realtimeChart = undefined; return; }

    const colors: Record<string, string> = { mq3: '#00d4ff', mq5: '#ff9800', mq135: '#00e676' };
    const timestamps = [...new Set(items.map(m => m.timestamp))].sort();
    const labels = timestamps.map(t =>
      new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );

    this.realtimeChart?.destroy();
    const ctx = this.realtimeChartCanvas.nativeElement.getContext('2d')!;
    this.realtimeChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: ['mq3', 'mq5', 'mq135'].map(st => {
          const pts = items
            .filter(m => m.sensorType === st)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          return {
            label: st.replace('mq', 'MQ-') + ' (ppm)',
            data: pts.map(m => m.ppm),
            borderColor: colors[st],
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointRadius: 3
          };
        })
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

  sensorLabel(type: string): string {
    return type.replace('mq', 'MQ-').toUpperCase();
  }
}
