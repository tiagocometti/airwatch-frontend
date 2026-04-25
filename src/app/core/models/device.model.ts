export interface Device {
  id: string;
  externalId: string;
  name: string;
  location: string;
  isActive: boolean;
  registeredAt: string;
}

export interface CreateDevice {
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
