import { Component, OnInit, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MeasurementService } from '../../core/services/measurement.service';
import { DeviceService } from '../../core/services/device.service';
import { Measurement } from '../../core/models/measurement.model';
import { Device, PagedResult } from '../../core/models/device.model';
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

  devices = signal<Device[]>([]);
  result = signal<PagedResult<Measurement> | null>(null);
  loading = signal(false);
  currentPage = signal(1);
  filterForm: FormGroup;
  sensorTypes = ['mq3', 'mq5', 'mq135'];
  private chart?: Chart;

  constructor(
    private measurementSvc: MeasurementService,
    private deviceSvc: DeviceService,
    private fb: FormBuilder
  ) {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.filterForm = this.fb.group({
      deviceId: [''],
      sensorType: [''],
      from: [from.toISOString().slice(0, 16)],
      to: [now.toISOString().slice(0, 16)]
    });
  }

  ngOnInit() {
    this.deviceSvc.getAll().subscribe(d => this.devices.set(d));
    this.loadMeasurements();
  }

  ngAfterViewInit() { setTimeout(() => this.renderChart(), 300); }
  ngOnDestroy() { this.chart?.destroy(); }

  applyFilters() { this.currentPage.set(1); this.loadMeasurements(); }

  goToPage(page: number) { this.currentPage.set(page); this.loadMeasurements(); }

  loadMeasurements() {
    this.loading.set(true);
    const { deviceId, sensorType, from, to } = this.filterForm.value;
    const obs = deviceId
      ? this.measurementSvc.getByDevice(deviceId, sensorType || undefined, this.currentPage(), 20)
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
    const items = this.result()!.items;
    const colors: Record<string, string> = { mq3: '#00d4ff', mq5: '#ff9800', mq135: '#00e676' };

    // Group by sensorType, use mq135 timestamps as x-axis labels
    const mq135 = [...items.filter(m => m.sensorType === 'mq135')].reverse().slice(-30);

    this.chart?.destroy();
    const ctx = this.chartCanvas.nativeElement.getContext('2d')!;
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: mq135.map(m => new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
        datasets: ['mq3', 'mq5', 'mq135'].map(st => {
          const pts = [...items.filter(m => m.sensorType === st)].reverse().slice(-30);
          return {
            label: st.replace('mq', 'MQ-') + ' (ppm)',
            data: pts.map(m => m.ppm),
            borderColor: colors[st],
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointRadius: 2
          };
        })
      },
      options: {
        responsive: true, maintainAspectRatio: false,
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

  ppmClass(v: number) { return v > 600 ? 'gas-high' : v > 400 ? 'gas-warn' : 'gas-ok'; }
  formatDateTime(t: string) { return new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
}
