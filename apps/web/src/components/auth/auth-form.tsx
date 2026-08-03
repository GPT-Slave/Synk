"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { sessionQueryKey, useSession } from "@/hooks/use-session";
import { ApiError, login, signup } from "@/lib/auth-api";

type Mode = "login" | "signup";

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function AuthForm({ mode }: { mode: Mode }) {
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
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) nextErrors.password = "Enter your password.";
    else if (isSignup) {
      if (password.length < 8)
        nextErrors.password = "Use at least 8 characters.";
      else if (password.length > 72)
        nextErrors.password = "Use no more than 72 characters.";
      else if (!/[a-z]/.test(password))
        nextErrors.password = "Add a lowercase letter.";
      else if (!/[A-Z]/.test(password))
        nextErrors.password = "Add an uppercase letter.";
      else if (!/[0-9]/.test(password)) nextErrors.password = "Add a number.";
      else if (!/[^A-Za-z0-9]/.test(password))
        nextErrors.password = "Add a special character.";

      if (password !== confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match.";
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
      : "Unable to connect to Calendra. Is the API running?"
    : null;

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      {serverError && (
        <div
          className="rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {serverError}
        </div>
      )}

      <Field
        autoComplete="email"
        error={errors.email}
        id="email"
        label="Email"
        onChange={setEmail}
        placeholder="you@example.com"
        type="email"
        value={email}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="auth-input pr-11"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isSignup ? "8+ strong characters" : "Your password"}
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition hover:text-foreground"
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
          label="Confirm password"
          onChange={setConfirmPassword}
          placeholder="Repeat your password"
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
        />
      )}

      <Button
        className="h-11 w-full shadow-[0_0_28px_oklch(0.68_0.29_25_/_0.24)]"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending && <LoaderCircle className="animate-spin" />}
        {isSignup ? "Create organizer account" : "Log in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? "Already organizing with Calendra?" : "New to Calendra?"}{" "}
        <Link
          className="font-medium text-primary hover:underline"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Log in" : "Create an account"}
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
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className="auth-input"
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
