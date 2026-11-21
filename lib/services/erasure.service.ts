import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/audit.service";
import { getCurrentProfile, isAdminRole } from "@/lib/services/profiles.service";
import { AppError, dbError } from "@/lib/errors";

// Este arquivo já foi o módulo de LGPD (fila de solicitações + termo
// versionado + anonimização). A fila e o termo saíram a pedido do usuário;
// o que sobrou é o que o botão "Excluir participante" sempre fez por baixo.
//
// Por que continua sendo limpeza de campos e não DELETE da linha: presença,
// encontros e acompanhamentos apontam para a participante. Apagar a linha
// levaria junto a contagem dos encontros de que ela participou — um encontro
// com 10 presentes passaria a mostrar 9, retroativamente. O histórico dos
// encontros é da comunidade, não dela; os dados pessoais, sim, são dela e
// são estes que somem aqui.

// Sem `as const`: esta lista vai para o `after` do audit_log, que é tipado
// como `Json`, e `Json` não aceita array readonly — que é no que o `as const`
// transforma o literal.
const CLEARED_FIELDS: string[] = [
  "full_name",
  "preferred_name",
  "phone",
  "whatsapp",
  "email",
  "birth_date",
  "address",
  "geo_lat",
  "geo_lng",
  "admin_notes",
];

export async function eraseParticipantNow(participantId: string, reason: string) {
  const profile = await getCurrentProfile();
  if (!isAdminRole(profile?.role)) {
    throw new AppError("Apenas a pastora ou a desenvolvedora podem excluir uma participante.");
  }

  const supabase = await createClient();
  const erasedAt = new Date().toISOString();

  const { data: participantRows, error: participantError } = await supabase
    .from("participants")
    .update({
      full_name: "Participante removida",
      preferred_name: null,
      phone: null,
      whatsapp: null,
      email: null,
      cpf: null,
      birth_date: null,
      address: null,
      geo_lat: null,
      geo_lng: null,
      admin_notes: null,
      anonymized_at: erasedAt,
      // `deleted_at` é o que faz a participante sumir das telas. Ela já era
      // filtrada (`deleted_at is null`) na lista de participantes, nos
      // contadores do dashboard, na vinculação automática a encontro novo e
      // na checagem de duplicata do cadastro público — mas NINGUÉM preenchia
      // a coluna, então a excluída continuava aparecendo em todas essas
      // telas como "Participante removida". Marcar aqui liga todos esses
      // filtros de uma vez.
      //
      // Continua sem DELETE da linha, pelo motivo do comentário no topo: a
      // ficha segue acessível pelo link direto e a presença nos encontros
      // passados não muda.
      deleted_at: erasedAt,
    })
    .eq("id", participantId)
    .select("id");
  if (participantError) dbError(participantError, "erasure.participant");
  // Exclusão é a única operação que não dá para conferir olhando a tela
  // depois (a ficha some). Se a RLS negasse, o retorno era zero linhas SEM
  // erro e a tela confirmava uma remoção que não aconteceu.
  if (!participantRows || participantRows.length === 0) {
    throw new AppError("Não foi possível excluir os dados desta participante. Nada foi alterado.");
  }

  const { error: followupsError } = await supabase
    .from("follow_ups")
    .update({ observation: "[removido]" })
    .eq("participant_id", participantId);
  if (followupsError) dbError(followupsError, "erasure.followups");

  // Só metadados no audit_log — nunca o conteúdo que acabou de ser apagado,
  // senão a remoção não remove nada, só muda de lugar.
  await logAuditEvent({
    action: "participant.erase",
    entity: "participants",
    entityId: participantId,
    after: {
      fields_cleared: CLEARED_FIELDS,
      follow_ups_observations_cleared: true,
      reason,
    },
  });
}
