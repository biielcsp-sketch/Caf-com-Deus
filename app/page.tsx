import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/services/profiles.service";

// Todo perfil abre no Feed; quem não está logada vai para o login.
export default async function RootPage() {
  const profile = await getCurrentProfile();
  redirect(profile ? "/feed" : "/login");
}
