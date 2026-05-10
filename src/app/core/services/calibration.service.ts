import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Calibration } from '../models/calibration.model';

const API = 'http://localhost:5119/api';

@Injectable({ providedIn: 'root' })
export class CalibrationService {
  constructor(private http: HttpClient) {}

  startCalibration(deviceId: string, location: string): Observable<{ calibrationId: string }> {
    return this.http.post<{ calibrationId: string }>(`${API}/calibrations/start`, { deviceId, location });
  }

  cancelCalibration(calibrationId: string): Observable<void> {
    return this.http.post<void>(`${API}/calibrations/${calibrationId}/cancel`, {});
  }

  activateCalibration(calibrationId: string): Observable<void> {
    return this.http.post<void>(`${API}/calibrations/${calibrationId}/activate`, {});
  }

  getCalibrations(deviceId: string): Observable<Calibration[]> {
    return this.http.get<Calibration[]>(`${API}/calibrations/device/${deviceId}`);
  }

  getActiveCalibration(deviceId: string): Observable<Calibration | null> {
    return this.http.get<Calibration | null>(`${API}/calibrations/device/${deviceId}/active`);
  }
}
