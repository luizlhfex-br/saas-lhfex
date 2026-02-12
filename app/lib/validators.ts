import { z } from "zod/v4";

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const clientSchema = z.object({
  cnpj: z.string().min(14, "CNPJ inválido").max(18),
  razaoSocial: z.string().min(1, "Razão social é obrigatória"),
  nomeFantasia: z.string().optional(),
  ramoAtividade: z.string().optional(),
  phone: z.string().optional(),
  email: z.email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zipCode: z.string().optional(),
  clientType: z.enum(["importer", "exporter", "both"]).default("importer"),
  status: z.enum(["active", "inactive", "prospect"]).default("active"),
  monthlyVolume: z.string().optional(),
  preferredCurrency: z.string().max(3).default("USD"),
  preferredIncoterm: z.string().optional(),
  notes: z.string().optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  role: z.string().optional(),
  email: z.email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  linkedin: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
