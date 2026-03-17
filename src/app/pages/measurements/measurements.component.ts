import { Component, OnInit, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MeasurementService } from '../../core/services/measurement.service';
import { SensorService } from '../../core/services/sensor.service';
import { Measurement } from '../../core/models/measurement.model';
import { Sensor, PagedResult } from '../../core/models/sensor.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-measurements',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './measurements.component.html',
  styleUrl: './measurements.component.css'
})
export class MeasurementsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  sensors = signal<Sensor[]>([]);
  result = signal<PagedResult<Measurement> | null>(null);
  loading = signal(false);
  currentPage = signal(1);
  filterForm: FormGroup;
  private chart?: Chart;

  constructor(
    private measurementSvc: MeasurementService,
    private sensorSvc: SensorService,
    private fb: FormBuilder
  ) {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.filterForm = this.fb.group({
      sensorId: [''],
      from: [from.toISOString().slice(0, 16)],
      to: [now.toISOString().slice(0, 16)]
    });
  }

  ngOnInit() {
    this.sensorSvc.getAll().subscribe(s => this.sensors.set(s));
    this.loadMeasurements();
  }

  ngAfterViewInit() { setTimeout(() => this.renderChart(), 300); }
  ngOnDestroy() { this.chart?.destroy(); }

  applyFilters() { this.currentPage.set(1); this.loadMeasurements(); }

  goToPage(page: number) { this.currentPage.set(page); this.loadMeasurements(); }

  loadMeasurements() {
    this.loading.set(true);
    const { sensorId, from, to } = this.filterForm.value;
    const obs = sensorId
      ? this.measurementSvc.getBySensor(sensorId, this.currentPage(), 20)
      : (from && to)
        ? this.measurementSvc.getByPeriod(new Date(from).toISOString(), new Date(to).toISOString(), this.currentPage(), 20)
        : this.measurementSvc.getLatest(this.currentPage(), 20);

    obs.subscribe({
      next: r => { this.result.set(r); this.loading.set(false); this.renderChart(); },
      error: () => this.loading.set(false)
    });
  }

  private renderChart() {
    if (!this.chartCanvas || !this.result()) return;
    const data = [...(this.result()!.items)].reverse().slice(-30);
    this.chart?.destroy();
    const ctx = this.chartCanvas.nativeElement.getContext('2d')!;
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(m => new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
        datasets: [
          { label: 'Gas (ppm)', data: data.map(m => m.gasValue), borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.07)', tension: 0.4, fill: true, pointRadius: 2 },
          { label: 'Temp. (C)', data: data.map(m => m.temperature), borderColor: '#ff9800', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 2 },
          { label: 'Umid. (%)', data: data.map(m => m.humidity), borderColor: '#00e676', backgroundColor: 'transparent', tension: 0.4, fill: false, pointRadius: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#0d1424', borderColor: 'rgba(0,212,255,0.2)', borderWidth: 1, titleColor: '#e2eef5', bodyColor: '#6a8fa8', padding: 10 }
        },
        scales: {
          x: { ticks: { color: '#334d61', font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: 'rgba(0,212,255,0.04)' } },
          y: { ticks: { color: '#334d61', font: { size: 10 } }, grid: { color: 'rgba(0,212,255,0.04)' } }
        }
      }
    });
  }

  gasClass(v: number) { return v > 600 ? 'gas-high' : v > 400 ? 'gas-warn' : 'gas-ok'; }
  formatDateTime(t: string) { return new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
}
