import type { Response } from 'express';

/**
 * Every successful response in the API uses this exact shape:
 *   { "success": true, "data": ... }
 * so clients never have to guess the envelope. Errors are handled
 * separately by errorHandler.ts, which mirrors this with
 * { "success": false, "error": {...} }.
 */
export function sendSuccess<T>(res: Response, statusCode: number, data: T): void {
  res.status(statusCode).json({ success: true, data });
}
