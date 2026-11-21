import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // S3 (headers de segurança): não publica source maps do bundle do
  // browser em produção — dificulta reconstruir nomes originais de
  // arquivo/variável a partir do JS minificado.
  productionBrowserSourceMaps: false,
  // Remove o header `X-Powered-By: Next.js`, que facilita fingerprint da
  // stack para quem está reconhecendo o alvo antes de atacar.
  poweredByHeader: false,
  // Novas inscrições e fila de distribuição passaram para a aba "Gestão de
  // Membros": links antigos (favoritos, mensagens) continuam funcionando.
  async redirects() {
    return [
      {
        source: "/participantes/novas-inscricoes",
        destination: "/gestao-membros/novas-inscricoes",
        permanent: true,
      },
      {
        source: "/participantes/aguardando-distribuicao",
        destination: "/gestao-membros/novas-inscricoes",
        permanent: true,
      },
      {
        source: "/participantes/aguardando-distribuicao/:id",
        destination: "/gestao-membros/novas-inscricoes",
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      // O padrão do Next.js é 1MB de corpo por Server Action. A foto de
      // perfil aceita até 2MB (limite do bucket `avatars`), então qualquer
      // selfie de celular estourava o limite ANTES de chegar na aplicação —
      // e o que aparecia na tela era a página de erro do navegador, não a
      // mensagem do app. 3MB dá folga para os 2MB do arquivo mais o
      // overhead do multipart, e continua dentro do limite de corpo da
      // função serverless da hospedagem.
      //
      // O estudo do mês (até 15MB) NÃO depende deste limite: aquele envio
      // vai do navegador direto para o Supabase Storage, justamente porque
      // 15MB não cabe em Server Action nenhuma (ver
      // lib/services/study-materials.service.ts).
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
