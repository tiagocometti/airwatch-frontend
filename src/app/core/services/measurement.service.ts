import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Measurement } from '../models/measurement.model';
import { PagedResult } from '../models/device.model';

const API = 'http://localhost:5119/api';

@Injectable({ providedIn: 'root' })
export class MeasurementService {
  constructor(private http: HttpClient) {}

  getLatest(page = 1, pageSize = 20) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<Measurement>>(`${API}/measurements/latest`, { params });
  }

  getByDevice(deviceId: string, sensorType?: string, page = 1, pageSize = 50) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (sensorType) params = params.set('sensorType', sensorType);
    return this.http.get<PagedResult<Measurement>>(`${API}/measurements/device/${deviceId}`, { params });
  }

  getByPeriod(from: string, to: string, page = 1, pageSize = 100) {
    const params = new HttpParams().set('from', from).set('to', to).set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResult<Measurement>>(`${API}/measurements/period`, { params });
  }
}
