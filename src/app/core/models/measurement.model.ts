export interface Measurement {
  id: string;
  deviceExternalId: string;
  sensorType: 'mq3' | 'mq5' | 'mq135';
  calibrated: boolean;
  adcRaw: number;
  voltageV: number;
  rsOhm: number;
  rsR0Ratio: number;
  ppm: number;
  timestamp: string;
}
