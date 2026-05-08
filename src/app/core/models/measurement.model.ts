export interface Measurement {
  id: string;
  deviceId: string;
  timestamp: string;
  mq3Adc: number;
  mq5Adc: number;
  mq135Adc: number;
  ppmAlcohol: number;
  ppmLpg: number;
  ppmCo2: number;
  ppmNh3: number;
}
