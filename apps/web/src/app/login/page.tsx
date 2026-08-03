import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Log in · Calendra" };

export default function LoginPage() {
  return (
    <AuthShell
      description="Welcome back. Your meetings and responses are waiting."
      title="Log in to Calendra"
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
