import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Log in · Synk" };

export default function LoginPage() {
  return (
    <AuthShell
      description="Welcome back. Your meetings and responses are waiting."
      titleKey="Log in to Synk"
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
