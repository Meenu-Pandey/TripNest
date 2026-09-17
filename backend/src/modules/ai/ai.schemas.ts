import { z } from 'zod';

export const tripIdParamsSchema = z.object({
  tripId: z.string().uuid('tripId must be a valid UUID'),
});

export const AI_ACTIONS = [
  'chat',
  'plan_day',
  'improve_itinerary',
  'trip_summary',
  'find_gaps',
] as const;

export type AiAction = (typeof AI_ACTIONS)[number];

export const aiRequestSchema = z.object({
  action: z.enum(AI_ACTIONS).default('chat'),
  prompt: z.string().trim().max(2000, 'Prompt cannot exceed 2000 characters').optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD')
    .optional(),
});

export type AiRequestInput = z.infer<typeof aiRequestSchema>;
