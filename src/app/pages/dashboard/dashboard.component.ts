import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DeviceService } from '../../core/services/device.service';
import { MeasurementService } from '../../core/services/measurement.service';
import { DeviceStatusService } from '../../core/services/device-status.service';
import { GasThresholdService } from '../../core/services/gas-threshold.service';
import { Device } from '../../core/models/device.model';
import { Measurement } from '../../core/models/measurement.model';
import { GasThreshold } from '../../core/models/gas-threshold.model';
import { GaugeComponent } from '../../shared/gauge/gauge.component';

type CalibrationBannerMap = Record<string, string>;

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, GaugeComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  loading      = signal(true);
  devices      = signal<Device[]>([]);
  measurements = signal<Measurement[]>([]);

  selectedDeviceId  = signal('');
  latestReading     = signal<Measurement | null>(null);
  realtimeLoading   = signal(false);

  calibrationBanners = signal<CalibrationBannerMap>({});

  private refreshInterval?: ReturnType<typeof setInterval>;
  private statusSub?: Subscription;
  private newMeasurementSub?: Subscription;
  private calStartedSub?: Subscription;
  private calEndedSub?: Subscription;

  activeDevices     = computed(() => this.devices().filter(d => d.isOnline).length);
  totalMeasurements = computed(() => this.measurements().length);

  lastMeasurementTime = computed(() => {
    const all = this.measurements();
    if (!all.length) return null;
    return all.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b).timestamp;
  });

  selectedDevice = computed(() =>
    this.devices().find(d => d.externalId === this.selectedDeviceId()) ?? null
  );

  thresholdCo2:     GasThreshold | undefined;
  thresholdNh3:     GasThreshold | undefined;
  thresholdLpg:     GasThreshold | undefined;
  thresholdAlcohol: GasThreshold | undefined;

  constructor(
    private deviceSvc: DeviceService,
    private measurementSvc: MeasurementService,
    private deviceStatusSvc: DeviceStatusService,
    private thresholdSvc: GasThresholdService,
    private router: Router
  ) {}

  ngOnInit() {
    this.thresholdCo2     = this.thresholdSvc.getByGasTarget('CO2');
    this.thresholdNh3     = this.thresholdSvc.getByGasTarget('NH3');
    this.thresholdLpg     = this.thresholdSvc.getByGasTarget('LPG');
    this.thresholdAlcohol = this.thresholdSvc.getByGasTarget('Alcohol');

    this.deviceStatusSvc.connect();

    this.statusSub = this.deviceStatusSvc.statusChanges$.subscribe(({ deviceId, isOnline, lastSeen }) => {
      this.devices.update(list =>
        list.map(d => d.externalId === deviceId ? { ...d, isOnline, lastSeen } : d)
      );
    });

    this.newMeasurementSub = this.deviceStatusSvc.newMeasurement$.subscribe(m => {
      if (m.deviceId === this.selectedDeviceId()) {
        this.latestReading.set(m);
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

  selectDevice(externalId: string) {
    if (this.selectedDeviceId() === externalId) {
      this.closeGaugeCard();
      return;
    }

    this.selectedDeviceId.set(externalId);
    this.latestReading.set(null);
    this.realtimeLoading.set(true);

    this.measurementSvc.getByDevice(externalId, 1, 1).subscribe({
      next: result => {
        this.latestReading.set(result.items[0] ?? null);
        this.realtimeLoading.set(false);
      },
      error: () => this.realtimeLoading.set(false)
    });
  }

  closeGaugeCard() {
    this.selectedDeviceId.set('');
    this.latestReading.set(null);
  }

  isCalibrating(externalId: string): boolean {
    return !!this.calibrationBanners()[externalId];
  }

  goToRegisterDevice() {
    this.router.navigate(['/sensors'], { queryParams: { openModal: true } });
  }

  formatLastMeasurement(timestamp: string | null): string {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}
