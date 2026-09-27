process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";
