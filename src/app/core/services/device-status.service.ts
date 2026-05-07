import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { AuthService } from './auth.service';

export interface DeviceStatusEvent {
  deviceId: string;
  isOnline: boolean;
  lastSeen: string | null;
}

@Injectable({ providedIn: 'root' })
export class DeviceStatusService {
  private readonly hubUrl = 'http://localhost:5119/hubs/device-status';
  private connection: signalR.HubConnection;

  readonly statusChanges$ = new Subject<DeviceStatusEvent>();

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
