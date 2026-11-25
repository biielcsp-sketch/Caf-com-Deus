import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Regressão estática: a entrada do sistema é o Feed para todo perfil, e a
// migration do mural mantém o avatar privado (só o caminho sai do banco).
describe("entrada no Feed e mural com autor", () => {
  it("login e raiz mandam todo perfil para /feed", () => {
    const auth = readFileSync("app/actions/auth.ts", "utf8");
    const raiz = readFileSync("app/page.tsx", "utf8");
    expect(auth).toContain('redirect("/feed")');
    expect(auth).not.toContain('redirect("/inicio")');
    expect(auth).not.toContain('redirect("/dashboard")');
    expect(raiz).toContain('"/feed"');
  });

  it("a função de nomes devolve só o caminho do avatar, nunca a imagem", () => {
    const sql = readFileSync(
      "supabase/migrations/20261125140000_mural_autor_e_participante_publica.sql",
      "utf8",
    );
    expect(sql).toContain("author_avatar_path");
    expect(sql).toContain("set search_path = public");
    expect(sql).toMatch(/revoke execute on function app_mural_names\(uuid\[\]\) from public, anon/);
  });

  it("participante só publica no próprio café, ativa e não anonimizada", () => {
    const sql = readFileSync(
      "supabase/migrations/20261125140000_mural_autor_e_participante_publica.sql",
      "utf8",
    );
    expect(sql).toContain("app_current_participant_id()");
    expect(sql).toContain("p.anonymized_at is null");
    expect(sql).toContain("p.deleted_at is null");
    expect(sql).toContain("author_profile_id = auth.uid()");
  });
});
