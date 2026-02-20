import { describe, it, expect } from "vitest";
import {
  loginSchema,
  clientSchema,
  invoiceSchema,
  processSchema,
  chatMessageSchema,
} from "~/lib/validators";

describe("Validators", () => {
  describe("loginSchema", () => {
    it("should accept valid email and password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = loginSchema.safeParse({
        email: "invalid-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("clientSchema", () => {
    it("should accept valid client data", () => {
      const result = clientSchema.safeParse({
        cnpj: "12345678901234",
        razaoSocial: "Test Company LTDA",
        nomeFantasia: "Test Company",
        clientType: "importer",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid client type", () => {
      const result = clientSchema.safeParse({
        cnpj: "12345678901234",
        razaoSocial: "Test Company",
        clientType: "invalid-type",
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional fields", () => {
      const result = clientSchema.safeParse({
        cnpj: "12345678901234",
        razaoSocial: "Test Company",
        clientType: "exporter",
        address: "Rua Test, 123",
        city: "São Paulo",
        state: "SP",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("invoiceSchema", () => {
    it("should accept valid invoice data", () => {
      const result = invoiceSchema.safeParse({
        clientId: "client-123",
        type: "receivable",
        status: "draft",
        currency: "BRL",
        total: "1000.00",
        dueDate: "2026-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid invoice type", () => {
      const result = invoiceSchema.safeParse({
        clientId: "client-123",
        type: "invalid",
        status: "draft",
        total: "1000",
      });
      expect(result.success).toBe(false);
    });

    it("should accept decimal total", () => {
      const result = invoiceSchema.safeParse({
        clientId: "client-123",
        type: "payable",
        status: "sent",
        total: "12345.67",
        dueDate: "2026-12-31",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe("12345.67");
      }
    });
  });

  describe("processSchema", () => {
    it("should accept valid process data", () => {
      const result = processSchema.safeParse({
        clientId: "client-123",
        reference: "PROC-2026-001",
        type: "import",
        status: "draft",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid process type", () => {
      const result = processSchema.safeParse({
        clientId: "client-123",
        reference: "PROC-001",
        type: "invalid-type",
        status: "draft",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("chatMessageSchema", () => {
    it("should accept valid chat message", () => {
      const result = chatMessageSchema.safeParse({
        message: "Hello, how can I help you?",
        agentId: "airton",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty message", () => {
      const result = chatMessageSchema.safeParse({
        message: "",
        agentId: "iana",
      });
      expect(result.success).toBe(false);
    });

    it("should accept message with conversationId", () => {
      const result = chatMessageSchema.safeParse({
        message: "Continue the conversation",
        agentId: "maria",
        conversationId: "conv-123",
      });
      expect(result.success).toBe(true);
    });
  });
});
