import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Mensagem é obrigatória").max(5000, "Mensagem muito longa"),
  agentId: z.enum(["airton", "iana", "maria", "iago"]),
  conversationId: z.string().uuid().optional(),
});

export const clientSchema = z.object({
  cnpj: z.string().min(14, "CNPJ inválido").max(18),
  razaoSocial: z.string().min(1, "Razão social é obrigatória").max(500),
  nomeFantasia: z.string().max(500).optional(),
  ramoAtividade: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  email: z.email("Email inválido").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  city: z.string().max(255).optional(),
  state: z.string().max(2).optional(),
  zipCode: z.string().max(10).optional(),
  clientType: z.enum(["importer", "exporter", "both"]).default("importer"),
  status: z.enum(["active", "inactive", "prospect"]).default("active"),
  monthlyVolume: z.string().max(100).optional(),
  preferredCurrency: z.string().max(3).default("USD"),
  preferredIncoterm: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
  role: z.string().max(255).optional(),
  email: z.email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  linkedin: z.string().max(500).optional(),
  isPrimary: z.boolean().default(false),
});

export const processSchema = z.object({
  processType: z.enum(["import", "export", "services"]),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  description: z.string().max(2000).optional(),
  hsCode: z.string().max(20).optional(),
  hsDescription: z.string().max(1000).optional(),
  incoterm: z.string().max(10).optional(),
  originCountry: z.string().max(100).optional(),
  destinationCountry: z.string().max(100).optional(),
  currency: z.string().max(3).optional(),
  totalValue: z.string().optional(),
  totalWeight: z.string().optional(),
  containerCount: z.string().optional(),
  containerType: z.string().max(20).optional(),
  vessel: z.string().max(255).optional(),
  bl: z.string().max(100).optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  portOfOrigin: z.string().max(255).optional(),
  portOfDestination: z.string().max(255).optional(),
  customsBroker: z.string().max(255).optional(),
  diNumber: z.string().max(50).optional(),
  googleDriveUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(5000).optional(),
  status: z.enum(["draft", "in_progress", "awaiting_docs", "customs_clearance", "in_transit", "delivered", "completed", "cancelled"]).optional(),
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  processId: z.string().optional(),
  type: z.enum(["receivable", "payable"]),
  category: z.string().max(50).optional(),
  currency: z.string().max(3).optional(),
  exchangeRate: z.string().optional(),
  subtotal: z.string().min(1, "Subtotal é obrigatório"),
  taxes: z.string().optional(),
  total: z.string().min(1, "Total é obrigatório"),
  dueDate: z.string().min(1, "Vencimento é obrigatório"),
  description: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type ProcessInput = z.infer<typeof processSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
