import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService } from '../../core/services/device.service';
import { MeasurementService } from '../../core/services/measurement.service';
import { Device } from '../../core/models/device.model';
import { Measurement } from '../../core/models/measurement.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  loading = signal(true);
  devices = signal<Device[]>([]);
  measurements = signal<Measurement[]>([]);
  selectedDevice = signal('');

  private chart?: Chart;
  private refreshInterval?: ReturnType<typeof setInterval>;

  // Card por device × sensor type (3 por device)
  deviceCards = computed(() => {
    const sensorTypes: Array<'mq3' | 'mq5' | 'mq135'> = ['mq3', 'mq5', 'mq135'];
    const result: { device: Device; sensorType: string; label: string; latest: Measurement | undefined; level: string }[] = [];

    for (const device of this.devices()) {
      for (const sensorType of sensorTypes) {
        const readings = this.measurements()
          .filter(m => m.deviceExternalId === device.externalId && m.sensorType === sensorType);
        const latest = readings.length
          ? readings.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b)
          : undefined;

        const ppm = latest?.ppm ?? 0;
        const level = ppm > 600 ? 'danger' : ppm > 400 ? 'warning' : 'success';
        const label = sensorType.replace('mq', 'MQ-');

        result.push({ device, sensorType, label, latest, level });
      }
    }
    return result;
  });

  activeDevices = computed(() => this.devices().filter(d => d.isActive).length);
  totalMeasurements = computed(() => this.measurements().length);

  avgPpm = computed(() => {
    const vals = this.deviceCards()
      .map(c => c.latest?.ppm)
      .filter((v): v is number => v !== undefined);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '--';
  });

  avgPpmLevel = computed(() => {
    const v = this.avgPpm();
    if (v === '--') return 'accent';
    return (v as number) > 600 ? 'danger' : (v as number) > 400 ? 'warning' : 'success';
  });

  constructor(private deviceSvc: DeviceService, private measurementSvc: MeasurementService) {}

  ngOnInit() {
    this.loadData();
    this.refreshInterval = setInterval(() => this.loadData(), 30000);
  }

  ngAfterViewInit() {}

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.chart?.destroy();
  }

  loadData() {
    this.loading.set(true);
    this.deviceSvc.getAll().subscribe({
      next: devices => {
        this.devices.set(devices);
        this.measurementSvc.getLatest(1, 150).subscribe({
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

  selectDevice(externalId: string) {
    this.selectedDevice.set(externalId);
    setTimeout(() => this.loadChart(externalId), 100);
  }

  private loadChart(deviceId: string) {
    this.measurementSvc.getByDevice(deviceId, undefined, 1, 60).subscribe(result => {
      const sensorTypes: Array<'mq3' | 'mq5' | 'mq135'> = ['mq3', 'mq5', 'mq135'];
      const colors: Record<string, string> = { mq3: '#00d4ff', mq5: '#ff9800', mq135: '#00e676' };

      // Use mq135 timestamps as labels (latest 20 points)
      const mq135 = [...result.items.filter(m => m.sensorType === 'mq135')].reverse().slice(-20);

      this.chart?.destroy();
      if (!this.chartCanvas) return;
      const ctx = this.chartCanvas.nativeElement.getContext('2d')!;
      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: mq135.map(m => new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
          datasets: sensorTypes.map(st => {
            const pts = [...result.items.filter(m => m.sensorType === st)].reverse().slice(-20);
            return {
              label: st.replace('mq', 'MQ-') + ' (ppm)',
              data: pts.map(m => m.ppm),
              borderColor: colors[st],
              backgroundColor: colors[st].replace(')', ',0.06)').replace('rgb', 'rgba'),
              tension: 0.4,
              fill: st === 'mq135',
              pointRadius: 3,
              pointBackgroundColor: colors[st]
            };
          })
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#6a8fa8', font: { family: 'Exo 2', size: 12 }, boxWidth: 12, padding: 20 } },
            tooltip: {
              backgroundColor: '#0d1424', borderColor: 'rgba(0,212,255,0.2)', borderWidth: 1,
              titleColor: '#e2eef5', bodyColor: '#6a8fa8', padding: 12
            }
          },
          scales: {
            x: { ticks: { color: '#334d61', font: { size: 11 } }, grid: { color: 'rgba(0,212,255,0.04)' } },
            y: { title: { display: true, text: 'ppm', color: '#6a8fa8', font: { size: 11 } }, ticks: { color: '#334d61', font: { size: 11 } }, grid: { color: 'rgba(0,212,255,0.04)' } }
          }
        }
      });
    });
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
