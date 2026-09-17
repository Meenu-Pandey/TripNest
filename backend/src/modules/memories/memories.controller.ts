import type { Request, Response } from 'express';
import { ValidationError } from '@/errors/AppError';
import { sendSuccess } from '@/lib/response';
import * as memoriesService from './memories.service';
import type { UploadMemoryInput } from './memories.schemas';

export async function uploadMemoryController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const input = req.body as UploadMemoryInput;
  if (!req.file) {
    throw new ValidationError('A photo file is required (multipart field name: "photo")');
  }
  const photo = await memoriesService.uploadMemoryPhoto(
    tripId,
    req.userId as string,
    { buffer: req.file.buffer, size: req.file.size, mimetype: req.file.mimetype },
    input,
  );
  sendSuccess(res, 201, { memory: photo });
}

export async function listMemoriesController(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const result = await memoriesService.listMemoryPhotos(
    tripId,
    req.userId as string,
    page,
    pageSize,
  );
  sendSuccess(res, 200, result);
}

export async function deleteMemoryController(req: Request, res: Response): Promise<void> {
  const { tripId, memoryId } = req.params as { tripId: string; memoryId: string };
  const result = await memoriesService.deleteMemoryPhoto(tripId, req.userId as string, memoryId);
  sendSuccess(res, 200, result);
}
