"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { multiplyCafeAction, type MultiplyState } from "@/app/actions/multiplication";
import { Button } from "@/components/ui/Button";
import { Picker } from "@/components/ui/Picker";
import { AVAILABILITY_DAYS, AVAILABILITY_DAY_LABELS } from "@/lib/validators/participant.schema";
import type { CafeMember, CafeOption } from "@/lib/services/multiplication.service";

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary";
const labelClass = "mb-1 block text-xs font-medium text-foreground";

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {n}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

// Assistente da multiplicação, numa tela só:
// 1) café que está multiplicando; 2) quem vai liderar o novo café;
// 3) quem vai junto — várias de uma vez; 4) dados do novo café.
export function MultiplyCafeForm({
  cafes,
  origemId,
  members,
}: {
  cafes: CafeOption[];
  origemId: string | null;
  members: CafeMember[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<MultiplyState, FormData>(multiplyCafeAction, undefined);
  const [liderId, setLiderId] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");

  const origem = cafes.find((c) => c.id === origemId) ?? null;
  const lider = members.find((m) => m.id === liderId) ?? null;
  const candidatas = members.filter((m) => m.id !== liderId);
  const visiveis = useMemo(
    () => candidatas.filter((m) => m.full_name.toLowerCase().includes(busca.trim().toLowerCase())),
    [candidatas, busca],
  );

  if (state && "success" in state && state.success) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5">
        <h2 className="text-base font-semibold text-foreground">Multiplicação registrada 🌱</h2>
        <p className="text-sm text-foreground">
          O café <strong>{state.cafeName}</strong> foi criado a partir de {origem?.name ?? "o café de origem"}, com{" "}
          {state.transferidas} participante(s) transferida(s). O histórico de cada uma ficou guardado.
        </p>
        {state.contaCriada && (
          <p className="text-sm text-foreground">
            O acesso da nova líder foi criado com o e-mail <strong>{state.email}</strong> e a senha provisória que você
            digitou. Passe a senha para ela por WhatsApp — no primeiro acesso ela é obrigada a trocar.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/cafes/multiplicacao"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Ver na árvore de multiplicação
          </Link>
          <Link href="/gestao-membros" className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
            Voltar para Gestão de Membros
          </Link>
        </div>
      </section>
    );
  }

  const toggle = (id: string) =>
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const todasVisiveisMarcadas = visiveis.length > 0 && visiveis.every((m) => selecionadas.has(m.id));

  return (
    <form action={action} className="flex flex-col gap-4">
      <Passo n={1} titulo="Café que está multiplicando">
        <Picker
          value={origemId ?? ""}
          onChange={(v) => {
            setLiderId("");
            setSelecionadas(new Set());
            router.push(v ? `/gestao-membros/multiplicacao?origem=${v}` : "/gestao-membros/multiplicacao");
          }}
          options={cafes.map((c) => ({
            value: c.id,
            label: c.name,
            description: `${c.leaderName} · ${c.participantes} participante(s)`,
          }))}
          title="Café que está multiplicando"
          placeholder="Escolha o café"
        />
        {origem && <input type="hidden" name="originGroupId" value={origem.id} />}
      </Passo>

      {origem && members.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Este café não tem participantes no momento.
        </p>
      )}

      {origem && members.length > 0 && (
        <>
          <Passo n={2} titulo="Quem vai liderar o novo café">
            <Picker
              name="newLeaderParticipantId"
              value={liderId}
              onChange={(v) => {
                setLiderId(v);
                setSelecionadas((prev) => {
                  const next = new Set(prev);
                  next.delete(v);
                  return next;
                });
              }}
              options={members.map((m) => ({
                value: m.id,
                label: m.full_name,
                description: m.hasAccount ? "Já tem acesso ao app" : "Ainda sem acesso ao app",
              }))}
              title="Quem vai liderar o novo café"
              placeholder="Escolha a participante"
            />

            <input type="hidden" name="needsAccount" value={lider && !lider.hasAccount ? "1" : "0"} />
            {lider && !lider.hasAccount && (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-accent/15 p-3 sm:grid-cols-2">
                <p className="text-xs text-foreground sm:col-span-2">
                  {lider.full_name} ainda não tem acesso ao app. Para liderar, ela precisa de um login: informe o
                  e-mail e uma senha provisória (ela troca no primeiro acesso).
                </p>
                <div>
                  <label className={labelClass} htmlFor="email">
                    E-mail
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={lider.email ?? ""}
                    key={lider.id}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="password">
                    Senha provisória
                  </label>
                  <input id="password" name="password" minLength={8} required className={inputClass} />
                </div>
              </div>
            )}
            {lider && lider.hasAccount && (
              <p className="mt-2 text-xs text-muted-foreground">
                Ela já tem acesso ao app: passa a entrar como líder com o mesmo login.
              </p>
            )}
          </Passo>

          <Passo n={3} titulo={`Quem vai para o novo café (${selecionadas.size} selecionada(s))`}>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por nome"
                className={`${inputClass} sm:max-w-xs`}
              />
              <button
                type="button"
                onClick={() =>
                  setSelecionadas((prev) => {
                    const next = new Set(prev);
                    for (const m of visiveis) {
                      if (todasVisiveisMarcadas) next.delete(m.id);
                      else next.add(m.id);
                    }
                    return next;
                  })
                }
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {todasVisiveisMarcadas ? "Desmarcar todas" : "Marcar todas"}
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {visiveis.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      name="participantIds"
                      value={m.id}
                      checked={selecionadas.has(m.id)}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4"
                    />
                    {m.full_name}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Quem não for marcada continua no café {origem.name}. A nova líder sai da lista do café de origem
              automaticamente.
            </p>
          </Passo>

          <Passo n={4} titulo="Dados do novo café">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="name">
                  Nome do café
                </label>
                <input id="name" name="name" required minLength={2} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <span className={labelClass}>Dia(s) do encontro (vazio = mesmo do café de origem)</span>
                <div className="flex flex-wrap gap-3">
                  {AVAILABILITY_DAYS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name="available_days" value={d} className="h-4 w-4" />
                      {AVAILABILITY_DAY_LABELS[d]}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="meeting_time">
                  Horário
                </label>
                <input id="meeting_time" name="meeting_time" type="time" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="capacity">
                  Capacidade (vazio = mesma do café de origem)
                </label>
                <input id="capacity" name="capacity" type="number" min={1} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="address">
                  Endereço
                </label>
                <input id="address" name="address" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="region">
                  Região
                </label>
                <input id="region" name="region" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="date">
                  Data da multiplicação
                </label>
                <input id="date" name="date" type="date" className={inputClass} />
              </div>
            </div>
          </Passo>

          {state && "error" in state && state.error && <p className="text-sm text-danger">{state.error}</p>}
          <Button type="submit" disabled={pending || !liderId}>
            {pending ? "Registrando..." : `Multiplicar e transferir ${selecionadas.size} participante(s)`}
          </Button>
        </>
      )}
    </form>
  );
}
