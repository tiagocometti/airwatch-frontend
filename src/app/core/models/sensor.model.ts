export interface Sensor {
  id?: string;
  externalId: string;
  name: string;
  location: string;
  isActive: boolean;
}

export interface RegisterSensorRequest {
  externalId: string;
  name: string;
  location: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
