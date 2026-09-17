import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '@/lib/jwt';

describe('jwt', () => {
  it('round-trips a payload through sign and verify', () => {
    const token = signAccessToken({ sub: 'user-123' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
  });

  it('produces a token with three dot-separated segments', () => {
    const token = signAccessToken({ sub: 'user-123' });
    expect(token.split('.')).toHaveLength(3);
  });

  it('throws when verifying a garbage token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow();
  });

  it('throws when verifying a token signed with a different secret', () => {
    const foreignToken = jwt.sign({ sub: 'user-123' }, 'a-completely-different-secret');
    expect(() => verifyAccessToken(foreignToken)).toThrow();
  });

  it('throws when the payload has no sub claim', () => {
    const badToken = jwt.sign({ notSub: 'user-123' }, process.env.JWT_SECRET as string, {
      algorithm: 'HS256',
    });
    expect(() => verifyAccessToken(badToken)).toThrow('Malformed token payload');
  });

  it('rejects a token signed with an unexpected algorithm (alg confusion defense)', () => {
    // jwt.sign with algorithm 'none' requires an explicit opt-in and no
    // secret; this simulates a token that claims a different algorithm
    // than the one verifyAccessToken pins.
    const noneAlgToken = jwt.sign({ sub: 'user-123' }, '', {
      algorithm: 'none' as jwt.Algorithm,
    });
    expect(() => verifyAccessToken(noneAlgToken)).toThrow();
  });
});
