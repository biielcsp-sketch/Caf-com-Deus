"use client";

// Só entra em cena quando a falha acontece no próprio layout raiz — por isso
// precisa trazer <html> e <body> e não pode usar as classes do tema, que vêm
// justamente do layout que falhou.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", lineHeight: 1.5 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Algo deu errado</h1>
        <p style={{ color: "#555", maxWidth: "32rem" }}>
          Não foi possível carregar o aplicativo. Tente de novo em instantes.
        </p>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#777" }}>{error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1rem",
            padding: "0.6rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#9b2e2b",
            color: "#fff",
            fontSize: "0.875rem",
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
