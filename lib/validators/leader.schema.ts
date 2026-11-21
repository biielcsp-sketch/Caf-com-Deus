import { z } from "zod";

export const LeaderCreateSchema = z.object({
  full_name: z.string().trim().min(2, { error: "Informe o nome completo." }),
  email: z.email({ error: "Informe um e-mail válido." }),
  // Senha provisória definida pela pastora e passada à líder por fora do
  // sistema (WhatsApp). Mínimo maior que o das outras senhas de propósito:
  // esta trafega por um canal que não controlamos, e a líder é obrigada a
  // trocá-la no primeiro acesso.
  password: z
    .string()
    .min(8, { error: "A senha provisória precisa ter pelo menos 8 caracteres." }),
  phone: z.string().trim().optional().nullable(),
  whatsapp: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().optional().nullable(),
  meeting_address: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
  max_capacity: z.coerce.number().int().positive({ error: "A capacidade deve ser maior que zero." }),
  // Co-líder tem a mesma função da líder — muda só como ela é chamada.
  role: z.enum(["lider", "co_lider"]).optional(),
});
export type LeaderCreateInput = z.infer<typeof LeaderCreateSchema>;

export const LeaderUpdateSchema = z.object({
  city: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().optional().nullable(),
  meeting_address: z.string().trim().optional().nullable(),
  region: z.string().trim().optional().nullable(),
  max_capacity: z.coerce.number().int().positive({ error: "A capacidade deve ser maior que zero." }),
  admin_notes: z.string().trim().optional().nullable(),
});
export type LeaderUpdateInput = z.infer<typeof LeaderUpdateSchema>;

// Dados da CONTA da líder (linha em `profiles` + e-mail de login em
// auth.users), separados dos dados do café acima porque vivem em outra
// tabela e o e-mail ainda precisa passar pela Admin API do Auth. Antes
// isso só existia na tela "Contas", exclusiva do perfil Desenvolvedor —
// a pastora ficava sem como corrigir um e-mail digitado errado no
// cadastro.
export const LeaderProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(2, { error: "Informe o nome completo." }),
  email: z.email({ error: "Informe um e-mail válido." }),
  phone: z.string().trim().optional().nullable(),
  whatsapp: z.string().trim().optional().nullable(),
});
export type LeaderProfileUpdateInput = z.infer<typeof LeaderProfileUpdateSchema>;

export const GroupSchema = z.object({
  name: z.string().trim().min(2, { error: "Informe o nome do grupo." }),
  // Opcional desde a migration `cafe_sem_lider`: o café pode ficar sem
  // responsável entre a exclusão de uma líder e a entrada da próxima.
  leader_id: z.string().uuid({ error: "Selecione a líder responsável." }).optional().nullable(),
  address: z.string().trim().optional().nullable(),
  capacity: z.coerce.number().int().positive({ error: "A capacidade deve ser maior que zero." }),
  region: z.string().trim().optional().nullable(),
  available_days: z.array(z.string()).optional().nullable(),
  meeting_time: z.string().optional().nullable(),
  host_profile_id: z.string().uuid().optional().nullable(),
  status: z.enum(["ativo", "inativo", "lotado"]).optional(),
});
export type GroupInput = z.infer<typeof GroupSchema>;
