import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { GasThreshold } from '../models/gas-threshold.model';

const API = 'http://localhost:5119/api';

@Injectable({ providedIn: 'root' })
export class GasThresholdService {
  private thresholds: GasThreshold[] = [];

  constructor(private http: HttpClient) {}

  load(): Promise<void> {
    return firstValueFrom(
      this.http.get<GasThreshold[]>(`${API}/sensor-coefficients/thresholds`).pipe(
        catchError(() => of([] as GasThreshold[]))
      )
    ).then(data => {
      this.thresholds = data;
    });
  }

  getAll(): GasThreshold[] {
    return this.thresholds;
  }

  getByGasTarget(gasTarget: string): GasThreshold | undefined {
    return this.thresholds.find(t => t.gasTarget === gasTarget);
  }
}
