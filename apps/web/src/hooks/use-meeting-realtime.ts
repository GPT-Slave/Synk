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
    let resyncTimer: number | undefined;
    let lastResyncAt = 0;
    const socket = io(`${SOCKET_URL}/meetings/${meetingId}`, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    });

    function resync(event?: { emittedAt?: number }, immediate = false) {
      if (disposed) return;
      if (typeof event?.emittedAt === "number") {
        window.dispatchEvent(
          new CustomEvent("synk:realtime-latency", {
            detail: { latencyMs: Math.max(0, Date.now() - event.emittedAt) },
          }),
        );
      }
      if (resyncTimer !== undefined) return;
      if (
        immediate &&
        queryClient.isFetching({
          queryKey: ["meetings", meetingId],
          exact: true,
        }) > 0
      ) {
        return;
      }
      const delay = immediate
        ? 0
        : Math.max(0, 1_000 - (Date.now() - lastResyncAt));
      resyncTimer = window.setTimeout(() => {
        resyncTimer = undefined;
        lastResyncAt = Date.now();
        void queryClient.invalidateQueries({
          queryKey: ["meetings", meetingId],
          exact: true,
        });
      }, delay);
    }

    socket.on("connect", () => setStatus("connecting"));
    socket.on("meeting:ready", () => {
      refreshAttempted = false;
      setStatus("live");
      resync(undefined, true);
    });
    socket.on("participant:joined", (event) => resync(event));
    socket.on("participant:removed", (event) => resync(event));
    socket.on("availability:changed", (event) => resync(event));
    socket.on("meeting:updated", (event) => resync(event));
    socket.on("meeting:state-changed", (event) => resync(event));
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
      if (resyncTimer !== undefined) window.clearTimeout(resyncTimer);
      socket.disconnect();
    };
  }, [meetingId, queryClient]);

  return status;
}