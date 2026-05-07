import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DeviceService } from '../../core/services/device.service';
import { Device } from '../../core/models/device.model';

@Component({
  selector: 'app-sensors',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sensors.component.html',
  styleUrl: './sensors.component.css'
})
export class SensorsComponent implements OnInit {
  devices = signal<Device[]>([]);
  loading = signal(true);
  showModal = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal(false);
  form: FormGroup;

  constructor(private deviceSvc: DeviceService, private fb: FormBuilder, private route: ActivatedRoute) {
    this.form = this.fb.group({
      externalId: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      name: ['', Validators.required],
      location: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.load();
    if (this.route.snapshot.queryParamMap.get('openModal') === 'true') {
      this.showModal.set(true);
    }
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
        setTimeout(() => { this.closeModal(); }, 1500);
      },
      error: e => {
        this.error.set(e.status === 409 ? 'Ja existe um dispositivo com este ID externo.' : 'Erro ao cadastrar dispositivo.');
        this.saving.set(false);
      }
    });
  }

  closeModal() {
    this.showModal.set(false);
    this.form.reset();
    this.error.set('');
    this.success.set(false);
  }
}
