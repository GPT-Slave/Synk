import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign up · Synk" };

export default function SignupPage() {
  return (
    <AuthShell
      description="Create polls, share one secure link, and find the overlap."
      titleKey="Start organizing"
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
