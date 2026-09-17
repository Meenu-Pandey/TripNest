import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { ValidationError } from '@/errors/AppError';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { MAX_FILE_SIZE_BYTES } from './fileValidation';
import {
  deleteMemoryController,
  listMemoriesController,
  uploadMemoryController,
} from './memories.controller';
import {
  listMemoriesQuerySchema,
  memoryParamsSchema,
  tripIdParamsSchema,
  uploadMemorySchema,
} from './memories.schemas';

/**
 * Memory storage (an in-memory Buffer per file, not multer's disk
 * storage engine) — the resulting buffer is handed to the
 * ObjectStorage abstraction (src/lib/storage/), which decides where it
 * actually ends up. `limits.fileSize` here is a defense-in-depth
 * rejection at the parsing layer, before the request body is even fully
 * buffered; `validateUploadedFile` in fileValidation.ts is the
 * authoritative check the service layer relies on regardless.
 */
const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('photo');

/**
 * Multer calls `next(err)` with its own `MulterError` class on failure
 * (oversized file, wrong field name, etc.) — without this translation,
 * that error would fall through errorHandler.ts's "unknown error"
 * branch and return a generic 500, when it's actually a plain client
 * input mistake that deserves a normal 400 VALIDATION_ERROR, consistent
 * with every other input-validation failure in this API.
 */
function handleUpload(req: Request, res: Response, next: NextFunction): void {
  uploadSingle(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      next(new ValidationError(err.message));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

export const memoryRouter = Router();

memoryRouter.post(
  '/:tripId/memories',
  authenticate,
  validate({ params: tripIdParamsSchema }),
  handleUpload,
  validate({ body: uploadMemorySchema }),
  asyncHandler(uploadMemoryController),
);

memoryRouter.get(
  '/:tripId/memories',
  authenticate,
  validate({ params: tripIdParamsSchema, query: listMemoriesQuerySchema }),
  asyncHandler(listMemoriesController),
);

memoryRouter.delete(
  '/:tripId/memories/:memoryId',
  authenticate,
  validate({ params: memoryParamsSchema }),
  asyncHandler(deleteMemoryController),
);
