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

    async function resync(event?: { emittedAt?: number }) {
      if (typeof event?.emittedAt === "number") {
        window.dispatchEvent(
          new CustomEvent("synk:realtime-latency", {
            detail: { latencyMs: Math.max(0, Date.now() - event.emittedAt) },
          }),
        );
      }
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
    socket.on("participant:joined", (event) => void resync(event));
    socket.on("participant:removed", (event) => void resync(event));
    socket.on("availability:changed", (event) => void resync(event));
    socket.on("meeting:state-changed", (event) => void resync(event));
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
