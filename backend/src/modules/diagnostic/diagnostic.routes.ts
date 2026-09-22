import { Router } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { OverpassProvider } from '@/providers/poi/overpassProvider';

const diagnosticRouter = Router();
const overpassProvider = new OverpassProvider();

diagnosticRouter.get(
    '/overpass',
    authenticate,
    asyncHandler(async (_req, res) => {
        const endpoints = await overpassProvider.probeEndpoints();
        res.status(200).json({ success: true, data: { endpoints } });
    }),
);

export { diagnosticRouter };