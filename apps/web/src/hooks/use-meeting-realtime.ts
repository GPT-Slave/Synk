"use client";

import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import { refreshOrganizerSession, SOCKET_URL } from "@/lib/auth-api";

export type RealtimeStatus = "connecting" | "live" | "offline";

export function useMeetingRealtime(meetingId: string): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    let refreshAttempted = false;
    let disposed = false;
    const socket = io(`${SOCKET_URL}/meetings/${meetingId}`, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    });

    async function resync() {
      await queryClient.invalidateQueries({
        queryKey: ["meetings", meetingId],
      });
    }

    socket.on("connect", () => setStatus("connecting"));
    socket.on("meeting:ready", () => {
      refreshAttempted = false;
      setStatus("live");
      void resync();
    });
    socket.on("participant:joined", () => void resync());
    socket.on("participant:removed", () => void resync());
    socket.on("availability:changed", () => void resync());
    socket.on("meeting:state-changed", () => void resync());
    socket.on("disconnect", () => {
      if (!disposed) setStatus("offline");
    });

    async function recoverSession() {
      if (refreshAttempted || disposed) return;
      refreshAttempted = true;
      try {
        await refreshOrganizerSession();
        if (!disposed) socket.connect();
      } catch {
        if (!disposed) setStatus("offline");
      }
    }

    socket.on("meeting:error", recoverSession);
    socket.on("connect_error", recoverSession);

    return () => {
      disposed = true;
      socket.disconnect();
    };
  }, [meetingId, queryClient]);

  return status;
}
