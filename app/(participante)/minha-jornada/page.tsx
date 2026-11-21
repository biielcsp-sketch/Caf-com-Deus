import Link from "next/link";
import { Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SecaoRetratil } from "@/components/ui/SecaoRetratil";
import { BackButton } from "@/components/ui/BackButton";
import { getCurrentProfile } from "@/lib/services/profiles.service";
import { getCurrentParticipant, getParticipantTimeline } from "@/lib/services/participants.service";
import { getParticipantAttendanceHistory } from "@/lib/services/attendance.service";
import { listGroupMeetings } from "@/lib/services/meetings.service";
import { Timeline } from "@/components/participantes/timeline";
import { AttendanceHistory } from "@/components/participantes/attendance-history";
import { getCafeRules } from "@/lib/services/cafe-rules.service";
import { PARTICIPANT_STATUS_LABELS } from "@/lib/participant-status-labels";
import { ConfirmMyAttendanceButton } from "@/components/presenca/confirm-my-attendance-button";
import { hojeEmSaoPaulo } from "@/lib/dates";

export default async function MinhaJornadaPage() {
  const profile = await getCurrentProfile();
  const participant = await getCurrentParticipant();

  if (!participant) {
    return (
      <div>
        <BackButton />
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          Olá, {profile?.full_name.split(" ")[0]} 🌷
        </h1>
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um cadastro de participante. Fale com a administradora.
          </p>
        </Card>
      </div>
    );
  }

  const [timeline, attendanceHistory, groupMeetings, cafeRules] = await Promise.all([
    getParticipantTimeline(participant.id),
    getParticipantAttendanceHistory(participant.id),
    participant.group ? listGroupMeetings(participant.group.id) : Promise.resolve([]),
    // Regras em branco não quebram a tela, mas a falha precisa deixar rastro.
    getCafeRules().catch((e: unknown) => {
      console.error("[minha-jornada] regras do café:", e);
      return "";
    }),
  ]);

  const confirmedMeetingIds = new Set(
    attendanceHistory.filter((a) => a.status === "presente").map((a) => a.meeting?.id),
  );
  const today = hojeEmSaoPaulo();
  const upcomingMeetings = groupMeetings.filter((m) => m.date >= today && m.status !== "cancelado");

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <div>
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">
          Olá, {profile?.full_name.split(" ")[0]} 🌷
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Líder: {participant.leader?.profile?.full_name ?? "sem líder"} · Grupo:{" "}
          {participant.group?.name ?? "sem grupo"}
        </p>
      </div>

      {/* Onde ela está no processo: já entrou num café ou ainda espera
          direcionamento. É a primeira dúvida de quem acabou de se cadastrar. */}
      <SecaoRetratil titulo="Meu processo">
        {participant.group ? (
          <>
            <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              Você já está em um café
            </span>
            <p className="mt-2 text-sm text-foreground">{participant.group.name}</p>
            <p className="text-sm text-muted-foreground">
              Com a líder {participant.leader?.profile?.full_name ?? "a definir"}
            </p>
          </>
        ) : (
          <>
            <span className="inline-flex rounded-full bg-accent/40 px-3 py-1 text-xs font-medium text-foreground">
              Aguardando direcionamento
            </span>
            <p className="mt-2 text-sm text-muted-foreground">
              Recebemos seu cadastro! Nossa equipe está escolhendo o café mais perto de você.
              Assim que isso acontecer, sua líder aparece aqui.
            </p>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Situação atual: {PARTICIPANT_STATUS_LABELS[participant.status]}
        </p>
      </SecaoRetratil>

      {cafeRules && (
        <SecaoRetratil titulo="Como funciona o café">
          <p className="whitespace-pre-line text-sm text-muted-foreground">{cafeRules}</p>
        </SecaoRetratil>
      )}

      {participant.leader && (
        <SecaoRetratil titulo="Minha líder">
          <p className="text-sm text-foreground">{participant.leader.profile?.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {participant.leader.profile?.phone ?? participant.leader.profile?.whatsapp ?? "sem contato informado"}
          </p>
        </SecaoRetratil>
      )}

      <SecaoRetratil titulo="Próximos encontros">
        {upcomingMeetings.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum encontro agendado.</p>
        )}
        <div className="flex flex-col gap-3">
          {upcomingMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${meeting.date}T00:00:00`).toLocaleDateString("pt-BR")}
                  {meeting.time ? ` — ${meeting.time.slice(0, 5)}` : ""}
                  {meeting.location ? ` — ${meeting.location}` : ""}
                </p>
              </div>
              {confirmedMeetingIds.has(meeting.id) ? (
                <span className="self-start rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary sm:self-auto">
                  Presença confirmada
                </span>
              ) : (
                <ConfirmMyAttendanceButton meetingId={meeting.id} />
              )}
            </div>
          ))}
        </div>
      </SecaoRetratil>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Meus dados</p>
          <Link
            href="/minha-jornada/editar"
            className="flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            <Pencil size={15} />
            Editar
          </Link>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Info label="Telefone" value={participant.phone} />
          <Info label="WhatsApp" value={participant.whatsapp} />
          <Info label="Endereço" value={participant.address} />
          <Info
            label="Disponível para encontros em casa"
            value={participant.home_meeting_ok ? "Sim" : "Não"}
          />
        </dl>
      </Card>

      <SecaoRetratil titulo="Minha jornada">
        <div className="mt-3">
          <Timeline entries={timeline} />
        </div>
      </SecaoRetratil>

      <SecaoRetratil titulo="Presença">
        <AttendanceHistory history={attendanceHistory} />
      </SecaoRetratil>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value || "—"}</dd>
    </div>
  );
}
