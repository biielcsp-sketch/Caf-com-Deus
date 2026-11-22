import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

// O visual (tamanho, cor, contorno) vive em .btn no globals.css, para os
// botões do sistema inteiro — inclusive os que não passam por este
// componente — terem um padrão só.
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />;
}
