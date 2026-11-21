import Image from "next/image";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <Image
        src="/icons/logo-header.png"
        alt="Café com Deus Shine"
        width={1600}
        height={1011}
        className="h-36 w-auto"
        priority
      />
      <Card className="glass-panel w-full max-w-sm rounded-[2.375rem] p-7">
        <div className="mb-6 text-center">
          <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-tight text-foreground">
            Entrar
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Entre com sua conta para continuar
          </p>
        </div>
        <LoginForm />
      </Card>
    </div>
  );
}
