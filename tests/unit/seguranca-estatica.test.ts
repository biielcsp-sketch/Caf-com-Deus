import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Regras de segurança que valem para o código inteiro. Complementam o Semgrep
// (que roda no CI) e falham localmente, antes de abrir o PR.

const RAIZ = process.cwd();

function arquivos(dir: string, exts: string[]): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "tests"].includes(nome)) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho, exts));
    else if (exts.some((e) => nome.endsWith(e))) saida.push(caminho);
  }
  return saida;
}

const codigo = ["app", "components", "lib"]
  .flatMap((d) => arquivos(join(RAIZ, d), [".ts", ".tsx"]))
  .concat(["proxy.ts", "instrumentation.ts"].map((f) => join(RAIZ, f)));

function achar(regex: RegExp) {
  return codigo
    .filter((f) => regex.test(readFileSync(f, "utf8")))
    .map((f) => relative(RAIZ, f));
}

describe("código do app", () => {
  it("não usa dangerouslySetInnerHTML (XSS)", () => {
    expect(achar(/dangerouslySetInnerHTML/)).toEqual([]);
  });

  it("não usa eval nem new Function", () => {
    expect(achar(/\beval\s*\(|new\s+Function\s*\(/)).toEqual([]);
  });

  it("não usa auth.getSession() (não valida o token no servidor)", () => {
    expect(achar(/auth\.getSession\s*\(/)).toEqual([]);
  });

  it("a chave mestra do Supabase só aparece em env.ts, admin.ts e na trava do client.ts", () => {
    // client.ts só a cita para RECUSAR uma chave secreta no navegador.
    expect(achar(/SERVICE_ROLE|sb_secret_/).sort()).toEqual([
      "lib/env.ts",
      "lib/supabase/admin.ts",
      "lib/supabase/client.ts",
    ]);
  });

  it("Client Components não importam módulos de servidor nem a chave mestra", () => {
    const clientes = codigo.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8").trimStart()));
    expect(clientes.length).toBeGreaterThan(0);
    // `import type` some na compilação e não leva código de servidor ao navegador.
    const proibidos = /^import\s+(?!type\b)[^;]*?from\s+["']@\/lib\/(supabase\/(admin|server)|env|services\/)/m;
    const ruins = clientes
      .filter((f) => proibidos.test(readFileSync(f, "utf8")))
      .map((f) => relative(RAIZ, f));
    expect(ruins).toEqual([]);
  });

  it("variáveis NEXT_PUBLIC_ nunca carregam chave secreta", () => {
    expect(achar(/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET)/)).toEqual([]);
  });
});

describe("migrations do banco", () => {
  const dir = join(RAIZ, "supabase", "migrations");
  const arqs = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const sql = arqs.map((f) => ({ f, s: readFileSync(join(dir, f), "utf8") }));
  const todo = sql.map((x) => x.s).join("\n");

  it("toda função security definer define search_path", () => {
    const ruins: string[] = [];
    for (const { f, s } of sql) {
      const re = /create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\([\s\S]*?\)\s*([\s\S]*?)\bas\s+\$/gi;
      for (const m of s.matchAll(re)) {
        if (/security\s+definer/i.test(m[2]) && !/set\s+search_path/i.test(m[2])) ruins.push(`${f}: ${m[1]}`);
      }
    }
    expect(ruins).toEqual([]);
  });

  it("toda tabela criada tem RLS ligado em alguma migration", () => {
    const tabelas = [...todo.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)].map(
      (m) => m[1],
    );
    expect(tabelas.length).toBeGreaterThan(0);
    const dropadas = new Set(
      [...todo.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)].map((m) => m[1]),
    );
    const semRls = tabelas.filter(
      (t) =>
        !dropadas.has(t) &&
        !new RegExp(`alter\\s+table\\s+(?:only\\s+)?(?:public\\.)?"?${t}"?\\s+enable\\s+row\\s+level\\s+security`, "i").test(
          todo,
        ),
    );
    expect(semRls).toEqual([]);
  });

  it("só estas funções podem ser executadas por anon (limite de tentativas e auditoria)", () => {
    const permitidas = new Set([
      "app_check_login_rate_limit",
      "app_check_claim_account_rate_limit",
      "app_log_auth_event",
      "app_check_public_enrollment_rate_limit",
    ]);
    const concedidas = [...todo.matchAll(/grant\s+execute\s+on\s+function\s+([\w.]+)\s*\([^)]*\)\s+to\s+([^;]+);/gi)]
      .filter((m) => /\banon\b|\bpublic\b/i.test(m[2]))
      .map((m) => m[1].replace(/^public\./, ""));
    expect(concedidas.filter((n) => !permitidas.has(n))).toEqual([]);
  });

  it("migrations têm nome com carimbo de data e ordem crescente", () => {
    for (const f of arqs) expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect([...arqs]).toEqual([...arqs].sort());
  });
});
