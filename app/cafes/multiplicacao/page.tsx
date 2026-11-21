import { redirect } from "next/navigation";

// Atalho usado pelos links "Ver na árvore de multiplicação": a árvore é uma
// aba da tela Cafés.
export default function MultiplicacaoRedirect() {
  redirect("/cafes?tab=multiplicacao");
}
