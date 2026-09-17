import { describe, it, expect } from '@jest/globals';
import { aiRequestSchema, tripIdParamsSchema, AI_ACTIONS } from '@/modules/ai/ai.schemas';

describe('AI Schemas', () => {
  describe('tripIdParamsSchema', () => {
    it('accepts a valid UUID', () => {
      const result = tripIdParamsSchema.safeParse({
        tripId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an invalid UUID', () => {
      const result = tripIdParamsSchema.safeParse({ tripId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('aiRequestSchema', () => {
    it('accepts valid actions without prompt or date', () => {
      for (const action of AI_ACTIONS) {
        const result = aiRequestSchema.safeParse({ action });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe(action);
        }
      }
    });

    it('defaults action to "chat" when omitted', () => {
      const result = aiRequestSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe('chat');
      }
    });

    it('rejects unsupported actions', () => {
      const result = aiRequestSchema.safeParse({ action: 'delete_database' });
      expect(result.success).toBe(false);
    });

    it('accepts valid YYYY-MM-DD date format', () => {
      const result = aiRequestSchema.safeParse({
        action: 'plan_day',
        date: '2026-08-15',
      });
      expect(result.success).toBe(true);
    });

    it('rejects malformed date formats', () => {
      expect(aiRequestSchema.safeParse({ date: '15-08-2026' }).success).toBe(false);
      expect(aiRequestSchema.safeParse({ date: '2026/08/15' }).success).toBe(false);
      expect(aiRequestSchema.safeParse({ date: 'tomorrow' }).success).toBe(false);
    });

    it('rejects prompts longer than 2000 characters', () => {
      const result = aiRequestSchema.safeParse({
        prompt: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it('accepts and trims prompts within 2000 characters', () => {
      const result = aiRequestSchema.safeParse({
        prompt: '   Can you suggest local seafood spots?   ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompt).toBe('Can you suggest local seafood spots?');
      }
    });
  });
});
