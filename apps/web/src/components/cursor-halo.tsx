"use client";

import { useEffect, useRef } from "react";

const HALO_SIZE = 72;

export function CursorHalo() {
  const haloRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const halo = haloRef.current;
    if (!halo) return;

    let frame = 0;
    let x = -HALO_SIZE;
    let y = -HALO_SIZE;

    const paint = () => {
      frame = 0;
      halo.style.transform = `translate3d(${x - HALO_SIZE / 2}px, ${y - HALO_SIZE / 2}px, 0)`;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        halo.style.opacity = "0";
        return;
      }
      x = event.clientX;
      y = event.clientY;
      halo.style.opacity = "1";
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    const hide = () => {
      halo.style.opacity = "0";
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] size-[72px] rounded-full opacity-0 transition-opacity duration-150 [background:radial-gradient(circle,rgba(96,165,250,0.22)_0%,rgba(56,189,248,0.09)_38%,transparent_72%)] blur-[5px] mix-blend-screen will-change-transform"
      data-cursor-halo="true"
      ref={haloRef}
    />
  );
}
