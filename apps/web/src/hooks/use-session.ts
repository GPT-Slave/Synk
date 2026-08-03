"use client";

import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/auth-api";

export const sessionQueryKey = ["auth", "session"] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: getSession,
  });
}
