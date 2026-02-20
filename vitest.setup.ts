import { beforeAll, afterAll } from "vitest";

// Mock environment variables for tests
beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-secret-key-for-testing-only";
  process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars!!";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
});

afterAll(() => {
  // Cleanup if needed
});
