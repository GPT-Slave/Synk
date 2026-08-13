"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import { InteractiveAvailabilityHeatmap as CoreHeatmap } from "@/components/meetings/interactive-availability-heatmap";
import { useI18n } from "@/lib/i18n";

type Props = ComponentProps<typeof CoreHeatmap>;

export function InteractiveAvailabilityHeatmap(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function syncButton(element: Element) {
      if (!(element instanceof HTMLButtonElement)) return;
      if (element.dataset.heatmapCell !== "true") return;

      const match = /·\s*(\d+)\/\d+$/.exec(element.title);
      if (match) element.dataset.availableCount = match[1];
    }

    function syncNode(node: Node) {
      if (!(node instanceof Element)) return;
      if (node.matches('button[data-heatmap-cell="true"]')) syncButton(node);
      node
        .querySelectorAll('button[data-heatmap-cell="true"]')
        .forEach(syncButton);
    }

    syncNode(root);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          syncButton(record.target as Element);
          continue;
        }
        record.addedNodes.forEach(syncNode);
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["title"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div data-heatmap-presentation="true" ref={rootRef}>
      {!props.manualMeetingMode && (
        <div className="mb-2 flex justify-end">
          <div
            className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground"
            data-selection-legend="true"
          >
            <span
              aria-hidden="true"
              className="relative h-3.5 w-6 overflow-hidden rounded-md border border-white/10 bg-sky-500/45"
            >
              <span className="absolute inset-x-0 bottom-0 h-1 bg-[#39ff14]" />
            </span>
            <span>{t("Your availability")}</span>
          </div>
        </div>
      )}
      <CoreHeatmap {...props} />
    </div>
  );
}
