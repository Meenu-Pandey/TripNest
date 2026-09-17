import { createAmountMinorSchema } from '@/lib/money';

describe('createAmountMinorSchema', () => {
  describe('allowZero: false (e.g. an expense amount)', () => {
    const schema = createAmountMinorSchema({ allowZero: false });

    it('accepts a positive integer string and converts to bigint', () => {
      const result = schema.safeParse('50000');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(50000n);
      }
    });

    it('rejects zero', () => {
      expect(schema.safeParse('0').success).toBe(false);
    });

    it('rejects a negative number string', () => {
      expect(schema.safeParse('-100').success).toBe(false);
    });

    it('rejects a non-integer string without throwing (regression: see docs/decisions.md #11)', () => {
      expect(() => schema.safeParse('100.50')).not.toThrow();
      expect(schema.safeParse('100.50').success).toBe(false);
    });

    it('rejects garbage input without throwing', () => {
      expect(() => schema.safeParse('not-a-number')).not.toThrow();
      expect(schema.safeParse('not-a-number').success).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(schema.safeParse('').success).toBe(false);
    });

    it('handles a very large value beyond Number.MAX_SAFE_INTEGER exactly', () => {
      const huge = '9007199254740995'; // MAX_SAFE_INTEGER + 2
      const result = schema.safeParse(huge);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(9007199254740995n);
      }
    });
  });

  describe('allowZero: true (e.g. a trip budget)', () => {
    const schema = createAmountMinorSchema({ allowZero: true });

    it('accepts zero', () => {
      const result = schema.safeParse('0');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0n);
      }
    });

    it('still rejects a negative number string', () => {
      expect(schema.safeParse('-1').success).toBe(false);
    });

    it('still rejects a non-integer string without throwing', () => {
      expect(() => schema.safeParse('1.5')).not.toThrow();
      expect(schema.safeParse('1.5').success).toBe(false);
    });
  });
});
