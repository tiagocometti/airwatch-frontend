import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SensorService } from '../../core/services/sensor.service';
import { MeasurementService } from '../../core/services/measurement.service';
import { Sensor } from '../../core/models/sensor.model';
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
  sensors = signal<Sensor[]>([]);
  measurements = signal<Measurement[]>([]);
  selectedSensor = signal('');

  private chart?: Chart;
  private refreshInterval?: ReturnType<typeof setInterval>;

  sensorCards = computed(() => {
    const latestBySensor = new Map<string, Measurement>();
    for (const m of this.measurements()) {
      if (!latestBySensor.has(m.sensorExternalId) ||
          new Date(m.timestamp) > new Date(latestBySensor.get(m.sensorExternalId)!.timestamp)) {
        latestBySensor.set(m.sensorExternalId, m);
      }
    }
    return this.sensors().map(s => {
      const latest = latestBySensor.get(s.externalId);
      const gas = latest?.gasValue ?? 0;
      const level = gas > 600 ? 'danger' : gas > 400 ? 'warning' : 'success';
      return { sensor: s, latest, level };
    });
  });

  activeSensors = computed(() => this.sensors().filter(s => s.isActive).length);
  totalMeasurements = computed(() => this.measurements().length);
  avgGas = computed(() => {
    const vals = this.sensorCards().map(c => c.latest?.gasValue).filter(v => v !== undefined) as number[];
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '--';
  });
  avgGasLevel = computed(() => {
    const v = this.avgGas();
    if (v === '--') return 'accent';
    return (v as number) > 600 ? 'danger' : (v as number) > 400 ? 'warning' : 'success';
  });
  avgTemp = computed(() => {
    const vals = this.sensorCards().map(c => c.latest?.temperature).filter(v => v !== undefined) as number[];
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '--';
  });

  constructor(private sensorSvc: SensorService, private measurementSvc: MeasurementService) {}

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
    this.sensorSvc.getAll().subscribe({
      next: sensors => {
        this.sensors.set(sensors);
        this.measurementSvc.getLatest(1, 100).subscribe({
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

  selectSensor(externalId: string) {
    this.selectedSensor.set(externalId);
    setTimeout(() => this.loadChart(externalId), 100);
  }

  private loadChart(sensorId: string) {
    this.measurementSvc.getBySensor(sensorId, 1, 50).subscribe(result => {
      const data = [...result.items].reverse();
      this.chart?.destroy();
      if (!this.chartCanvas) return;
      const ctx = this.chartCanvas.nativeElement.getContext('2d')!;
      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(m => new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
          datasets: [
            {
              label: 'Gas (ppm)',
              data: data.map(m => m.gasValue),
              borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.08)',
              tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#00d4ff'
            },
            {
              label: 'Temperatura (C)',
              data: data.map(m => m.temperature),
              borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.05)',
              tension: 0.4, fill: false, pointRadius: 2, pointBackgroundColor: '#ff9800'
            },
            {
              label: 'Umidade (%)',
              data: data.map(m => m.humidity),
              borderColor: '#00e676', backgroundColor: 'rgba(0,230,118,0.05)',
              tension: 0.4, fill: false, pointRadius: 2, pointBackgroundColor: '#00e676'
            }
          ]
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
            y: { ticks: { color: '#334d61', font: { size: 11 } }, grid: { color: 'rgba(0,212,255,0.04)' } }
          }
        }
      });
    });
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
