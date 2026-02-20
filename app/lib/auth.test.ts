import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword, verifyPassword } from "~/lib/auth.server";

describe("Auth Server", () => {
  describe("Password Hashing", () => {
    it("should hash password correctly", async () => {
      const password = "test-password-123";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(30);
    });

    it("should generate different hashes for same password", async () => {
      const password = "test-password-123";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it("should verify correct password", async () => {
      const password = "test-password-123";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "test-password-123";
      const wrongPassword = "wrong-password";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it("should handle empty passwords", async () => {
      const password = "";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it("should handle special characters", async () => {
      const password = "p@ssw0rd!#$%&*()";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it("should handle unicode characters", async () => {
      const password = "senha🔒segura";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });
  });
});
