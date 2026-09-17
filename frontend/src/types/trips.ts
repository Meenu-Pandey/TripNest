import type { PaginationMeta } from './api';

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';

export type TripStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type TripRole = 'OWNER' | 'MEMBER' | 'VIEWER';

export interface MoneyDTO {
  amountMinor: string;
  currency: SupportedCurrency;
}

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  destination: string | null;
  startDate: string;
  endDate: string;
  budget: MoneyDTO | null;
  currency: SupportedCurrency;
  status: TripStatus;
  role: TripRole;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTrips {
  trips: Trip[];
  pagination: PaginationMeta;
}

export interface CreateTripInput {
  name: string;
  description?: string | null;
  destination?: string | null;
  startDate: string;
  endDate: string;
  currency?: SupportedCurrency;
  budgetMinor?: string | null;
}

export interface UpdateTripInput {
  name?: string;
  description?: string | null;
  destination?: string | null;
  startDate?: string;
  endDate?: string;
  budgetMinor?: string | null;
  status?: TripStatus;
}
