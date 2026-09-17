import { exactSplit } from '@/modules/expenses/domain/split/exactSplit';
import { SplitValidationError } from '@/modules/expenses/domain/split/types';

describe('exactSplit', () => {
  it('accepts amounts that sum exactly to the total', () => {
    const result = exactSplit(1000n, [
      { tripMemberId: 'a', amountMinor: 600n },
      { tripMemberId: 'b', amountMinor: 400n },
    ]);
    expect(result).toEqual([
      { tripMemberId: 'a', shareAmountMinor: 600n },
      { tripMemberId: 'b', shareAmountMinor: 400n },
    ]);
  });

  it('allows a participant to be assigned exactly zero', () => {
    const result = exactSplit(1000n, [
      { tripMemberId: 'a', amountMinor: 1000n },
      { tripMemberId: 'b', amountMinor: 0n },
    ]);
    expect(result.find((r) => r.tripMemberId === 'b')?.shareAmountMinor).toBe(0n);
  });

  it('rejects amounts that sum to more than the total', () => {
    expect(() =>
      exactSplit(1000n, [
        { tripMemberId: 'a', amountMinor: 600n },
        { tripMemberId: 'b', amountMinor: 500n },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects amounts that sum to less than the total', () => {
    expect(() =>
      exactSplit(1000n, [
        { tripMemberId: 'a', amountMinor: 600n },
        { tripMemberId: 'b', amountMinor: 300n },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects a negative amount', () => {
    expect(() =>
      exactSplit(1000n, [
        { tripMemberId: 'a', amountMinor: 1200n },
        { tripMemberId: 'b', amountMinor: -200n },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects duplicate participants', () => {
    expect(() =>
      exactSplit(1000n, [
        { tripMemberId: 'a', amountMinor: 500n },
        { tripMemberId: 'a', amountMinor: 500n },
      ]),
    ).toThrow(SplitValidationError);
  });

  it('rejects an empty participant list', () => {
    expect(() => exactSplit(1000n, [])).toThrow(SplitValidationError);
  });

  it('handles a single participant covering the whole amount', () => {
    const result = exactSplit(1000n, [{ tripMemberId: 'solo', amountMinor: 1000n }]);
    expect(result[0]?.shareAmountMinor).toBe(1000n);
  });

  it('off-by-one paisa is rejected, not silently accepted', () => {
    expect(() =>
      exactSplit(1000n, [
        { tripMemberId: 'a', amountMinor: 500n },
        { tripMemberId: 'b', amountMinor: 499n },
      ]),
    ).toThrow(SplitValidationError);
  });
});
