"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sessionQueryKey } from "@/hooks/use-session";
import { logout } from "@/lib/auth-api";
import { useI18n } from "@/lib/i18n";

export function LogoutButton() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      router.replace("/login");
    },
  });

  return (
    <Button
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      variant="outline"
    >
      <LogOut />
      {t("Log out")}
    </Button>
  );
}
