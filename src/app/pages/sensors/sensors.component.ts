import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DeviceService } from '../../core/services/device.service';
import { DeviceStatusService } from '../../core/services/device-status.service';
import { Device } from '../../core/models/device.model';

@Component({
  selector: 'app-sensors',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sensors.component.html',
  styleUrl: './sensors.component.css'
})
export class SensorsComponent implements OnInit, OnDestroy {
  devices      = signal<Device[]>([]);
  loading      = signal(true);
  showModal    = signal(false);
  showSettings = signal(false);
  saving       = signal(false);
  error        = signal('');
  success      = signal(false);
  form:         FormGroup;
  settingsForm: FormGroup;
  selectedDevice = signal<Device | null>(null);

  private statusSub?: Subscription;

  constructor(
    private deviceSvc: DeviceService,
    private deviceStatusSvc: DeviceStatusService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.form = this.fb.group({
      externalId: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      name:       ['', Validators.required],
      location:   ['', Validators.required]
    });

    this.settingsForm = this.fb.group({
      name:     ['', Validators.required],
      location: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.deviceStatusSvc.connect();
    this.statusSub = this.deviceStatusSvc.statusChanges$.subscribe(({ deviceId, isOnline, lastSeen }) => {
      this.devices.update(list =>
        list.map(d => d.externalId === deviceId ? { ...d, isOnline, lastSeen } : d)
      );
    });
    this.load();
    if (this.route.snapshot.queryParamMap.get('openModal') === 'true') {
      this.showModal.set(true);
    }
  }

  ngOnDestroy() {
    this.statusSub?.unsubscribe();
  }

  load() {
    this.loading.set(true);
    this.deviceSvc.getAll().subscribe({
      next: d => { this.devices.set(d); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.deviceSvc.register(this.form.value).subscribe({
      next: () => {
        this.success.set(true);
        this.saving.set(false);
        this.load();
        setTimeout(() => this.closeModal(), 1500);
      },
      error: e => {
        this.error.set(e.status === 409 ? 'Ja existe um dispositivo com este ID externo.' : 'Erro ao cadastrar dispositivo.');
        this.saving.set(false);
      }
    });
  }

  openSettings(device: Device) {
    this.selectedDevice.set(device);
    this.settingsForm.setValue({ name: device.name, location: device.location });
    this.showSettings.set(true);
    this.error.set('');
    this.success.set(false);
  }

  saveSettings() {
    const device = this.selectedDevice();
    if (!device || this.settingsForm.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.deviceSvc.update(device.id, this.settingsForm.value).subscribe({
      next: updated => {
        this.devices.update(list => list.map(d => d.id === updated.id ? updated : d));
        this.success.set(true);
        this.saving.set(false);
        setTimeout(() => this.closeSettings(), 1200);
      },
      error: () => {
        this.error.set('Erro ao salvar. Tente novamente.');
        this.saving.set(false);
      }
    });
  }

  goToCalibrations(device: Device) {
    this.closeSettings();
    this.router.navigate(['/calibrations', device.id], { state: { externalId: device.externalId } });
  }

  closeSettings() {
    this.showSettings.set(false);
    this.selectedDevice.set(null);
    this.error.set('');
    this.success.set(false);
  }

  closeModal() {
    this.showModal.set(false);
    this.form.reset();
    this.error.set('');
    this.success.set(false);
  }
}
