export interface Calibration {
  id: string;
  deviceId: string;
  startedAt: string;
  completedAt?: string;
  status: 'InProgress' | 'Completed' | 'Cancelled' | 'Failed';
  location: string;
  r0Mq3?: number;
  r0Mq5?: number;
  r0Mq135?: number;
  sampleCount: number;
  duracaoSegundos: number;
  isActive: boolean;
}

export interface CalibrationProgress {
  deviceId: string;
  calibrationId: string;
  progressPercent: number;
  sampleCount: number;
  currentR0Mq3: number;
  currentR0Mq5: number;
  currentR0Mq135: number;
}

export interface CalibrationEvent {
  deviceId: string;
  calibrationId: string;
}

export interface CalibrationStartedEvent extends CalibrationEvent {
  startedAt: string;
  duracaoSegundos: number;
}

export interface CalibrationCompletedEvent extends CalibrationEvent {
  r0Mq3: number;
  r0Mq5: number;
  r0Mq135: number;
}

export interface CalibrationFailedEvent extends CalibrationEvent {
  reason: string;
}
