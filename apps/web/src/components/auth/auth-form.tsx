"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionQueryKey, useSession } from "@/hooks/use-session";
import { ApiError, login, signup } from "@/lib/auth-api";
import { useI18n } from "@/lib/i18n";

type Mode = "login" | "signup";

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useI18n();
  const isSignup = mode === "signup";
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (session.data) router.replace("/dashboard");
  }, [router, session.data]);

  const mutation = useMutation({
    mutationFn: isSignup ? signup : login,
    onSuccess: (data) => {
      queryClient.setQueryData(sessionQueryKey, data);
      router.replace("/dashboard");
    },
  });

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = t("Enter a valid email address.");
    }

    if (!password) nextErrors.password = t("Enter your password.");
    else if (isSignup) {
      if (password.length < 8)
        nextErrors.password = t("Use at least 8 characters.");
      else if (password.length > 72)
        nextErrors.password = t("Use no more than 72 characters.");
      else if (!/[a-z]/.test(password))
        nextErrors.password = t("Add a lowercase letter.");
      else if (!/[A-Z]/.test(password))
        nextErrors.password = t("Add an uppercase letter.");
      else if (!/[0-9]/.test(password)) nextErrors.password = t("Add a number.");
      else if (!/[^A-Za-z0-9]/.test(password))
        nextErrors.password = t("Add a special character.");

      if (password !== confirmPassword) {
        nextErrors.confirmPassword = t("Passwords do not match.");
      }
    }
    return nextErrors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.reset();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    mutation.mutate({ email: email.trim(), password });
  }

  const serverError = mutation.error
    ? mutation.error instanceof ApiError
      ? mutation.error.message
      : t("Unable to connect to Synk. Is the API running?")
    : null;

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {serverError && (
        <div
          className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {serverError}
        </div>
      )}

      <Field
        autoComplete="email"
        error={errors.email}
        id="email"
        label={t("Email")}
        onChange={setEmail}
        placeholder="you@example.com"
        type="email"
        value={email}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          {t("Password")}
        </label>
        <div className="relative">
          <Input
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="pe-11"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isSignup ? t("8+ strong characters") : t("Your password")}
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? t("Hide password") : t("Show password")}
            className="absolute inset-y-0 end-0 grid w-11 place-items-center text-muted-foreground transition hover:text-foreground"
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-300" id="password-error">
            {errors.password}
          </p>
        )}
      </div>

      {isSignup && (
        <Field
          autoComplete="new-password"
          error={errors.confirmPassword}
          id="confirm-password"
          label={t("Confirm password")}
          onChange={setConfirmPassword}
          placeholder={t("Repeat your password")}
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
        />
      )}

      <Button
        className="h-11 w-full shadow-glow"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending && <LoaderCircle className="animate-spin" />}
        {isSignup ? t("Create organizer account") : t("Log in")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? t("Already organizing with Synk?") : t("New to Synk?")}{" "}
        <Link
          className="font-medium text-primary hover:underline"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? t("Log in") : t("Sign up")}
        </Link>
      </p>
    </form>
  );
}

interface FieldProps {
  autoComplete: string;
  error?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  value: string;
}

function Field({
  autoComplete,
  error,
  id,
  label,
  onChange,
  placeholder,
  type,
  value,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error && (
        <p className="text-xs text-red-300" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
