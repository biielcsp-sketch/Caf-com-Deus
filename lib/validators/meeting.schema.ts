import { z } from "zod";

export const MeetingSchema = z.object({
  title: z.string().trim().min(2, { error: "Informe um título." }),
  group_id: z.string().uuid({ error: "Selecione o grupo." }),
  date: z.string().min(1, { error: "Informe a data." }),
  time: z.string().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  ministered_by: z.string().trim().optional().nullable(),
  status: z.enum(["planejado", "confirmado", "realizado", "cancelado"]).optional(),
});
export type MeetingInput = z.infer<typeof MeetingSchema>;

// Na edição o formulário não mostra o campo "Grupo" — um encontro não troca de
// café depois de criado. Sem `group_id` no FormData, validar a edição com o
// MeetingSchema fazia o zod recusar tudo com "Invalid input: expected string,
// received null", e nenhum encontro podia ser salvo.
export const MeetingUpdateSchema = MeetingSchema.omit({ group_id: true });
export type MeetingUpdateInput = z.infer<typeof MeetingUpdateSchema>;
