import type { Request, Response } from 'express';
import { sendSuccess } from '@/lib/response';
import * as placesService from './places.service';
import type { CreatePlaceInput, UpdatePlaceInput } from './places.schemas';

export async function createPlaceController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const input = req.body as CreatePlaceInput;
  const place = await placesService.createPlace(tripId, req.userId as string, input);
  sendSuccess(res, 201, { place });
}

export async function listPlacesController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const places = await placesService.listPlaces(tripId, req.userId as string);
  sendSuccess(res, 200, { places });
}

export async function getPlaceController(req: Request, res: Response): Promise<void> {
  const { tripId, placeId } = req.params as { tripId: string; placeId: string };
  const place = await placesService.getPlace(tripId, req.userId as string, placeId);
  sendSuccess(res, 200, { place });
}

export async function updatePlaceController(req: Request, res: Response): Promise<void> {
  const { tripId, placeId } = req.params as { tripId: string; placeId: string };
  const input = req.body as UpdatePlaceInput;
  const place = await placesService.updatePlace(tripId, req.userId as string, placeId, input);
  sendSuccess(res, 200, { place });
}

export async function deletePlaceController(req: Request, res: Response): Promise<void> {
  const { tripId, placeId } = req.params as { tripId: string; placeId: string };
  const result = await placesService.deletePlace(tripId, req.userId as string, placeId);
  sendSuccess(res, 200, result);
}
