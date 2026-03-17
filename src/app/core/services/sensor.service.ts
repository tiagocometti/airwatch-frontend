import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RegisterSensorRequest, Sensor } from '../models/sensor.model';

const API = 'http://localhost:5119/api';

@Injectable({ providedIn: 'root' })
export class SensorService {
  constructor(private http: HttpClient) {}

  getAll(page = 1, pageSize = 50) {
    return this.http.get<Sensor[]>(`${API}/sensors`);
  }

  getByExternalId(externalId: string) {
    return this.http.get<Sensor>(`${API}/sensors/${externalId}`);
  }

  register(req: RegisterSensorRequest) {
    return this.http.post<Sensor>(`${API}/sensors`, req);
  }
}
