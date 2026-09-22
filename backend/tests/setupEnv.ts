process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-real-environments-0000';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://tripnest:tripnest@localhost:5432/tripnest_test?schema=public';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.PORT = '4001';
process.env.GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || 'test-dummy-geoapify-key';
