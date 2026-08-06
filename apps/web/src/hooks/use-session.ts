"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { getSession } from "@/lib/auth-api";

export const sessionQueryKey = ["auth", "session"] as const;

export function useSession() {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: getSession,
    enabled: !isAuthPage,
    retry: false,
  });
}
