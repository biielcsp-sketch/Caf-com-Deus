import { z } from "zod";
import { birthDateIssue, emailTypoIssue, isValidCep, CHURCH_STATUSES } from "@/lib/field-rules";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { AVAILABILITY_DAYS, AVAILABILITY_PERIODS } from "@/lib/validators/participant.schema";

// Schema PRÓPRIO do cadastro público (Fase 9) — nunca reaproveita o schema
// administrativo de participante. status, current_leader_id, admin_notes e
// qualquer outro campo interno nunca vêm daqui — são decididos no servidor
// em public-enrollment.service.ts.
// v68: e-mail, CPF, pergunta de membro e senha também são obrigatórios — o
// cadastro termina com a criação do usuário e senha.
// Nome e telefone sempre obrigatórios; endereço, disponibilidade (dias e
// período) e preferência de localização também são obrigatórios a pedido
// do usuário — só cidade e bairro continuam opcionais.
export const PublicEnrollmentSchema = z.object({
  full_name: z.string().trim().min(2, { error: "Informe seu nome completo." }),
  preferred_name: z.string().trim().optional(),
  phone: z.string().trim().min(8, { error: "Informe um telefone válido, com DDD." }),
  whatsapp: z.string().trim().optional(),
  // E-mail é o usuário de login: obrigatório desde a v68.
  email: z
    .email({ error: "Informe um e-mail válido." })
    .refine((v) => !emailTypoIssue(v), { error: (i) => emailTypoIssue(i.input as string) ?? "E-mail inválido." }),
  // Só dígitos depois da transformação; o formulário mostra a máscara.
  cpf: z
    .string()
    .trim()
    .refine((value) => isValidCpf(value), { error: "Informe um CPF válido." })
    .transform((value) => onlyDigits(value)),
  // Igreja: Lagoinha Alphaville, outra igreja (com o nome) ou nenhuma.
  // Obrigatória. `is_lagoinha_member` (sim/não) continua sendo gravado, derivado
  // desta resposta, para não quebrar o que já lê esse campo.
  church_status: z.enum(CHURCH_STATUSES, { error: "Informe sobre a sua igreja." }),
  church_name: z.string().trim().optional(),
  password: z.string().min(6, { error: "A senha precisa ter pelo menos 6 caracteres." }),
  confirmPassword: z.string(),
  birth_date: z
    .string()
    .optional()
    .refine((v) => !birthDateIssue(v), { error: (i) => birthDateIssue(i.input as string) ?? "Data inválida." }),
  cep: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : undefined))
    .refine((v) => !v || isValidCep(v), { error: "CEP inválido: informe os 8 dígitos." }),
  city: z.string().trim().optional(),
  neighborhood: z.string().trim().optional(),
  address: z.string().trim().min(1, { error: "Informe seu endereço." }),
  availability_days: z
    .array(z.enum(AVAILABILITY_DAYS))
    .min(1, { error: "Selecione ao menos um dia disponível." }),
  availability_period: z
    .array(z.enum(AVAILABILITY_PERIODS))
    .min(1, { error: "Selecione ao menos um período disponível." }),
  location_preference: z.string().trim().min(1, { error: "Informe sua preferência de localização." }),
  home_meeting_ok: z.boolean().optional(),
  other_notes: z.string().trim().optional(),
  // Única coisa que sobrou do antigo módulo de consentimento: a pessoa que
  // preencheu autoriza a equipe a procurá-la. Sem isso o cadastro não entra —
  // ninguém vai receber ligação de um café que não pediu.
  contact_authorized: z.literal(true, {
    error: "É preciso autorizar o contato da equipe para se inscrever.",
  }),
  code: z.string().trim().min(1, { error: "Link de inscrição inválido." }),
  // Honeypot (Q2 desenha o campo escondido na tela): humano nunca preenche.
  // Se vier com valor, o service descarta a inscrição silenciosamente.
  website: z.string().optional(),
})
  .refine((data) => data.password === data.confirmPassword, {
    error: "As senhas não coincidem.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.church_status !== "outra" || !!data.church_name?.trim(), {
    error: "Informe o nome da sua igreja.",
    path: ["church_name"],
  });
export type PublicEnrollmentInput = z.infer<typeof PublicEnrollmentSchema>;
