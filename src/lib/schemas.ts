import { z } from "zod";
import { REF_RE } from "./calc";
import { YM_RE } from "./dates";

const MAX_CENTS = 100_000_000_000; // R$ 1 bilhão

export const ymSchema = z.string().regex(YM_RE, "Mês inválido.");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .nullable();
const cents = z.number().int().min(-MAX_CENTS).max(MAX_CENTS);
const ref = z.string().regex(REF_RE, "Referência inválida.").nullable();
const sign = z.union([z.literal(1), z.literal(-1)]);
const memberId = z.string().min(1).max(64).nullable();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome muito longo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  password: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .max(100, "Senha muito longa."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha.").max(100),
});

export const accountPatchSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80).optional(),
  currentPassword: z.string().max(100).optional(),
  newPassword: z
    .string()
    .min(8, "A nova senha precisa ter pelo menos 8 caracteres.")
    .max(100)
    .optional(),
  autoMonth: z.enum(["copy", "structure", "off"]).optional(),
  surplusMode: z.enum(["ask", "auto", "off"]).optional(),
  surplusGoal: z.string().min(1).max(64).nullable().optional(),
  surplusPct: z.number().int().min(1, "Porcentagem entre 1 e 100.").max(100, "Porcentagem entre 1 e 100.").optional(),
});

export const accountDeleteSchema = z.object({ password: z.string().min(1, "Informe sua senha.") });

export const extraColumnSchema = z.object({
  id: z.string().min(1).max(40).regex(/^[\w-]+$/),
  name: z.string().trim().min(1, "Dê um nome à coluna.").max(40, "Nome da coluna muito longo."),
  type: z.enum(["text", "number", "currency", "date"]),
});

export const monthPatchSchema = z.object({ dismissAuto: z.boolean().optional() });

export const surplusActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    goalId: z.string().min(1).max(64).nullable(),
    pct: z.number().int().min(1, "Porcentagem entre 1 e 100.").max(100, "Porcentagem entre 1 e 100."),
  }),
  z.object({ action: z.enum(["skip", "undo", "dismiss"]) }),
]);

export const startMonthSchema = z.object({
  mode: z.enum(["default", "blank", "copy", "structure"]),
});

export const blockCreateSchema = z.object({
  ym: ymSchema,
  name: z.string().trim().min(1, "Dê um nome à tabela.").max(60, "Nome da tabela muito longo."),
  kind: z.enum(["income", "expense", "savings", "total"]),
  columns: z.array(extraColumnSchema).max(12).optional(),
  memberId: memberId.optional(),
  source: ref.optional(),
  card: z.boolean().optional(),
  rows: z
    .array(z.object({ description: z.string().max(200), ref, sign }))
    .max(30)
    .optional(),
});

export const blockPatchSchema = z.object({
  name: z.string().trim().min(1, "A tabela precisa de um nome.").max(60).optional(),
  budgetType: z.enum(["none", "amount", "percent"]).optional(),
  budgetValue: z.number().min(0).max(MAX_CENTS).optional(),
  columns: z.array(extraColumnSchema).max(12, "No máximo 12 colunas extras por tabela.").optional(),
  memberId: memberId.optional(),
  source: ref.optional(),
  card: z.boolean().optional(),
  cardPaid: cents.min(0).nullable().optional(),
  cardClose: z.number().int().min(1, "Dia entre 1 e 31.").max(31, "Dia entre 1 e 31.").nullable().optional(),
  cardDue: z.number().int().min(1, "Dia entre 1 e 31.").max(31, "Dia entre 1 e 31.").nullable().optional(),
});

export const faturaMoveSchema = z.object({ entryIds: z.array(z.string().min(1).max(64)).max(500).optional() });

export const reorderSchema = z.object({
  ym: ymSchema,
  ids: z.array(z.string().min(1).max(64)).max(200),
});

export const completeSchema = z.object({ status: z.enum(["pending", "done"]) });

export const entryCreateSchema = z.object({
  blockId: z.string().min(1),
  description: z.string().max(200).optional(),
  amount: cents.optional(),
  date: isoDate.optional(),
  status: z.enum(["pending", "done"]).optional(),
  goalId: z.string().nullable().optional(),
  target: cents.min(0).nullable().optional(),
  ref: ref.optional(),
  sign: sign.optional(),
  payWith: z.string().min(1).max(64).nullable().optional(),
});

export const entryPatchSchema = z.object({
  description: z.string().max(200, "Descrição muito longa (máx. 200).").optional(),
  amount: cents.optional(),
  date: isoDate.optional(),
  status: z.enum(["pending", "done"]).optional(),
  goalId: z.string().nullable().optional(),
  target: cents.min(0).nullable().optional(),
  ref: ref.optional(),
  sign: sign.optional(),
  payWith: z.string().min(1).max(64).nullable().optional(),
  extra: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.null()])).optional(),
});

export const installmentCreateSchema = z
  .object({
    blockId: z.string().min(1).max(64),
    description: z.string().trim().min(1, "Descreva a compra.").max(200),
    /** valor total da compra, em centavos */
    total: cents.min(1, "Informe o valor da compra."),
    count: z.number().int().min(2, "Parcele em pelo menos 2 vezes.").max(72, "No máximo 72 parcelas."),
    /** parcela que cai neste mês (compras feitas antes começam no meio) */
    currentNo: z.number().int().min(1),
    date: isoDate.optional(),
    payWith: z.string().min(1).max(64).nullable().optional(),
  })
  .refine((v) => v.currentNo <= v.count, { message: "A parcela atual passa do número de parcelas." });

export const installmentDeleteSchema = z.object({ fromYm: ymSchema });

export const goalCreateSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à meta.").max(60),
  targetAmount: z.number().int().min(0).max(MAX_CENTS),
  targetMonth: z.string().regex(YM_RE).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const goalPatchSchema = goalCreateSchema.partial();

export const memberCreateSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à pessoa.").max(40, "Nome muito longo."),
  color: hexColor.optional(),
});

export const memberPatchSchema = memberCreateSchema.partial();

const importKey = z.string().min(1).max(300);

export const importPreviewSchema = z.object({
  ym: ymSchema,
  keys: z.array(importKey).max(3000),
});

export const importSchema = z.object({
  ym: ymSchema,
  /** cartão que paga as despesas importadas (fatura); null = saem do saldo */
  payWith: z.string().min(1).max(64).nullable(),
  rows: z
    .array(
      z.object({
        key: importKey,
        blockId: z.string().min(1).max(64),
        description: z.string().max(200),
        /** centavos, como no extrato: negativo = saída */
        amount: cents,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
      }),
    )
    .min(1, "Escolha pelo menos um lançamento para importar.")
    .max(3000, "No máximo 3000 lançamentos por vez."),
  learn: z
    .array(z.object({ pattern: z.string().max(200), blockId: z.string().min(1).max(64) }))
    .max(3000),
});

export const importRulePatchSchema = z.object({
  pattern: z.string().trim().min(1, "A regra precisa de pelo menos uma palavra.").max(120),
});
