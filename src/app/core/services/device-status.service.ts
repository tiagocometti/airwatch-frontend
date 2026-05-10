import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { Measurement } from '../models/measurement.model';
import {
  CalibrationProgress,
  CalibrationEvent,
  CalibrationStartedEvent,
  CalibrationCompletedEvent,
  CalibrationFailedEvent
} from '../models/calibration.model';

export interface DeviceStatusEvent {
  deviceId: string;
  isOnline: boolean;
  lastSeen: string | null;
}

@Injectable({ providedIn: 'root' })
export class DeviceStatusService {
  private readonly hubUrl = 'http://localhost:5119/hubs/device-status';
  private connection: signalR.HubConnection;

  readonly statusChanges$         = new Subject<DeviceStatusEvent>();
  readonly newMeasurement$        = new Subject<Measurement>();
  readonly calibrationStarted$    = new Subject<CalibrationStartedEvent>();
  readonly calibrationProgress$   = new Subject<CalibrationProgress>();
  readonly calibrationCompleted$  = new Subject<CalibrationCompletedEvent>();
  readonly calibrationFailed$     = new Subject<CalibrationFailedEvent>();
  readonly calibrationCancelled$  = new Subject<CalibrationEvent>();

  constructor(private authSvc: AuthService) {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => this.authSvc.getToken() ?? ''
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('DeviceStatusChanged', (event: DeviceStatusEvent) => {
      this.statusChanges$.next(event);
    });

    this.connection.on('NewMeasurement', (measurement: Measurement) => {
      this.newMeasurement$.next(measurement);
    });

    this.connection.on('CalibrationStarted', (event: CalibrationStartedEvent) => {
      this.calibrationStarted$.next(event);
    });

    this.connection.on('CalibrationProgress', (event: CalibrationProgress) => {
      this.calibrationProgress$.next(event);
    });

    this.connection.on('CalibrationCompleted', (event: CalibrationCompletedEvent) => {
      this.calibrationCompleted$.next(event);
    });

    this.connection.on('CalibrationFailed', (event: CalibrationFailedEvent) => {
      this.calibrationFailed$.next(event);
    });

    this.connection.on('CalibrationCancelled', (event: CalibrationEvent) => {
      this.calibrationCancelled$.next(event);
    });
  }

  connect() {
    if (this.connection.state === signalR.HubConnectionState.Disconnected) {
      this.connection.start().catch(err =>
        console.error('SignalR connection error:', err)
      );
    }
  }

  disconnect() {
    this.connection.stop();
  }
}
