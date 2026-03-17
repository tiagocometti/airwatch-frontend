export interface Measurement {
  id: string;
  sensorId: string;
  sensorExternalId: string;
  gasValue: number;
  temperature: number;
  humidity: number;
  timestamp: string;
}
