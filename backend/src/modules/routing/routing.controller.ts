import type { Request, Response } from 'express';
import { requireTripMembership } from '@/modules/trips/trip-access.service';
import { getDrivingRoute } from './routing.service';

export async function getTripRoutingController(req: Request, res: Response) {
  const tripId = req.params.tripId as string;
  const requesterId = req.userId as string;
  await requireTripMembership(tripId, requesterId);

  const originLat = parseFloat(req.query.originLat as string);
  const originLng = parseFloat(req.query.originLng as string);
  const destLat = parseFloat(req.query.destLat as string);
  const destLng = parseFloat(req.query.destLng as string);

  const routeResult = await getDrivingRoute(originLat, originLng, destLat, destLng);

  res.status(200).json({
    success: true,
    data: routeResult,
  });
}
