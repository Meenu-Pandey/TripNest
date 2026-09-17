import type { Request, Response } from 'express';
import { sendSuccess } from '@/lib/response';
import * as itineraryService from './itinerary.service';
import type {
  CreateItineraryItemInput,
  ReorderItineraryInput,
  UpdateItineraryItemInput,
} from './itinerary.schemas';

export async function createItineraryItemController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const input = req.body as CreateItineraryItemInput;
  const item = await itineraryService.createItineraryItem(tripId, req.userId as string, input);
  sendSuccess(res, 201, { item });
}

export async function listItineraryController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const items = await itineraryService.listItinerary(tripId, req.userId as string);
  sendSuccess(res, 200, { items });
}

export async function updateItineraryItemController(req: Request, res: Response): Promise<void> {
  const { itemId } = req.params as { itemId: string };
  const input = req.body as UpdateItineraryItemInput;
  const item = await itineraryService.updateItineraryItem(itemId, req.userId as string, input);
  sendSuccess(res, 200, { item });
}

export async function deleteItineraryItemController(req: Request, res: Response): Promise<void> {
  const { itemId } = req.params as { itemId: string };
  const result = await itineraryService.deleteItineraryItem(itemId, req.userId as string);
  sendSuccess(res, 200, result);
}

export async function reorderItineraryController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const input = req.body as ReorderItineraryInput;
  const items = await itineraryService.reorderItinerary(tripId, req.userId as string, input);
  sendSuccess(res, 200, { items });
}
