"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="pl-1.5 text-[13px] font-semibold text-foreground">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-[54px] text-[15px]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="pl-1.5 text-[13px] font-semibold text-foreground">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-[54px] text-[15px]"
        />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending} className="mt-2 h-[58px] w-full text-base font-semibold">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
