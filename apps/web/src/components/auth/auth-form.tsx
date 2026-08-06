"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyRound,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
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

  const passwordChecks = [
    { label: t("Use at least 8 characters."), passed: password.length >= 8 },
    { label: t("Add an uppercase letter."), passed: /[A-Z]/.test(password) },
    { label: t("Add a number."), passed: /[0-9]/.test(password) },
    {
      label: t("Add a special character."),
      passed: /[^A-Za-z0-9]/.test(password),
    },
  ];
  const passwordScore = passwordChecks.filter((item) => item.passed).length;

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {serverError && (
        <div
          className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm text-foreground"
          role="alert"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>{serverError}</span>
        </div>
      )}

      <Field
        autoComplete="email"
        error={errors.email}
        icon={<Mail />}
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
        <div className="group relative">
          <span className="pointer-events-none absolute inset-y-0 start-0 grid w-11 place-items-center text-muted-foreground transition group-focus-within:text-primary [&_svg]:size-4">
            <LockKeyRound />
          </span>
          <Input
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="h-12 rounded-xl border-border/80 bg-background/65 ps-11 pe-12 shadow-none transition focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-primary/10"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isSignup ? t("8+ strong characters") : t("Your password")}
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? t("Hide password") : t("Show password")}
            className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
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
          <p className="text-xs text-destructive" id="password-error">
            {errors.password}
          </p>
        )}
      </div>

      {isSignup && (
        <>
          <div className="rounded-2xl border border-border/65 bg-muted/25 p-3.5">
            <div className="mb-3 grid grid-cols-4 gap-1.5" aria-hidden="true">
              {passwordChecks.map((check, index) => (
                <span
                  className={`h-1.5 rounded-full transition-colors ${
                    index < passwordScore ? "bg-primary" : "bg-border"
                  }`}
                  key={check.label}
                />
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {passwordChecks.map((check) => (
                <div
                  className={`flex items-center gap-2 text-xs transition-colors ${
                    check.passed ? "text-foreground" : "text-muted-foreground"
                  }`}
                  key={check.label}
                >
                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded-full ${
                      check.passed
                        ? "bg-primary text-primary-foreground"
                        : "border border-border"
                    }`}
                  >
                    {check.passed && <Check className="size-2.5" />}
                  </span>
                  <span>{check.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Field
            autoComplete="new-password"
            error={errors.confirmPassword}
            icon={<LockKeyRound />}
            id="confirm-password"
            label={t("Confirm password")}
            onChange={setConfirmPassword}
            placeholder={t("Repeat your password")}
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
          />
        </>
      )}

      <Button
        className="group h-12 w-full rounded-xl text-sm font-semibold shadow-glow"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <ArrowRight className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        )}
        {isSignup ? t("Create organizer account") : t("Log in")}
      </Button>

      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="size-1 rounded-full bg-primary/60" />
        <span className="h-px flex-1 bg-border" />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? t("Already organizing with Synk?") : t("New to Synk?")}{" "}
        <Link
          className="inline-flex rounded-md font-semibold text-primary underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
  icon: ReactNode;
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
  icon,
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
      <div className="group relative">
        <span className="pointer-events-none absolute inset-y-0 start-0 grid w-11 place-items-center text-muted-foreground transition group-focus-within:text-primary [&_svg]:size-4">
          {icon}
        </span>
        <Input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className="h-12 rounded-xl border-border/80 bg-background/65 ps-11 shadow-none transition focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-primary/10"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
