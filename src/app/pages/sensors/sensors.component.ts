import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SensorService } from '../../core/services/sensor.service';
import { Sensor } from '../../core/models/sensor.model';

@Component({
  selector: 'app-sensors',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sensors.component.html',
  styleUrl: './sensors.component.css'
})
export class SensorsComponent implements OnInit {
  sensors = signal<Sensor[]>([]);
  loading = signal(true);
  showModal = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal(false);
  form: FormGroup;

  constructor(private sensorSvc: SensorService, private fb: FormBuilder) {
    this.form = this.fb.group({
      externalId: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      name: ['', Validators.required],
      location: ['', Validators.required]
    });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.sensorSvc.getAll().subscribe({
      next: s => { this.sensors.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.sensorSvc.register(this.form.value).subscribe({
      next: () => {
        this.success.set(true);
        this.saving.set(false);
        this.load();
        setTimeout(() => { this.closeModal(); }, 1500);
      },
      error: e => {
        this.error.set(e.status === 409 ? 'Ja existe um sensor com este ID externo.' : 'Erro ao cadastrar sensor.');
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
