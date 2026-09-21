import type { Request, Response } from 'express';
import { sendSuccess } from '@/lib/response';
import * as tripService from './trip.service';
import type { CreateTripInput, ListTripsQuery, UpdateTripInput } from './trip.schemas';

export async function createTripController(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateTripInput;
  const trip = await tripService.createTrip(req.userId as string, input);
  sendSuccess(res, 201, { trip });
}

export async function listTripsController(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListTripsQuery;
  const result = await tripService.listTrips(req.userId as string, query);
  sendSuccess(res, 200, result);
}

export async function getTripController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const trip = await tripService.getTrip(tripId, req.userId as string);
  sendSuccess(res, 200, { trip });
}

export async function updateTripController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const input = req.body as UpdateTripInput;
  const trip = await tripService.updateTrip(tripId, req.userId as string, input);
  sendSuccess(res, 200, { trip });
}

export async function deleteTripController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const result = await tripService.deleteTrip(tripId, req.userId as string);
  sendSuccess(res, 200, { trip: result });
}

export async function completeTripController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const trip = await tripService.completeTrip(tripId, req.userId as string);
  sendSuccess(res, 200, { trip });
}

export async function cancelTripController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const trip = await tripService.cancelTrip(tripId, req.userId as string);
  sendSuccess(res, 200, { trip });
}
