import { redirect } from "next/navigation";

// A fila passou a ser uma seção da tela de novas inscrições (um passo a
// menos). A rota fica só para links antigos.
export default function AguardandoDistribuicaoPage() {
  redirect("/gestao-membros/novas-inscricoes");
}
