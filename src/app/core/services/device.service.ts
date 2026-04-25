import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CreateDevice, Device } from '../models/device.model';

const API = 'http://localhost:5119/api';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<Device[]>(`${API}/devices`);
  }

  getByExternalId(externalId: string) {
    return this.http.get<Device>(`${API}/devices/${externalId}`);
  }

  register(req: CreateDevice) {
    return this.http.post<Device>(`${API}/devices`, req);
  }
}
