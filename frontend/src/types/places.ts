export interface PlaceDTO {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  externalProvider: string | null;
  externalPlaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlaceInput {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  externalProvider?: string | null;
  externalPlaceId?: string | null;
}

export interface UpdatePlaceInput {
  name?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  externalProvider?: string | null;
  externalPlaceId?: string | null;
}
export type Place = PlaceDTO;
