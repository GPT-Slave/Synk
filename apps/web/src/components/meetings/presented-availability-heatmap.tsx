"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import { InteractiveAvailabilityHeatmap as CoreHeatmap } from "@/components/meetings/interactive-availability-heatmap";
import { useI18n } from "@/lib/i18n";

const MOBILE_QUERY = "(max-width: 639px)";
const TOOLTIP_SELECTOR = '[data-heatmap-tooltip="true"]';

type Props = ComponentProps<typeof CoreHeatmap>;

export function InteractiveAvailabilityHeatmap(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const currentRoot = rootRef.current;
    if (!currentRoot) return;
    const heatmapRoot: HTMLDivElement = currentRoot;

    let dismissedTooltipSignature: string | undefined;

    function syncButton(element: Element) {
      if (!(element instanceof HTMLButtonElement)) return;
      if (element.dataset.heatmapCell !== "true") return;

      const match = /·\s*(\d+)\/\d+$/.exec(element.title);
      if (match) element.dataset.availableCount = match[1];
    }

    function tooltipSignature(element: HTMLElement) {
      return `${element.getAttribute("style") ?? ""}|${element.textContent ?? ""}`;
    }

    function revealChangedTooltip(element: Element) {
      if (!(element instanceof HTMLElement)) return;
      if (element.dataset.heatmapTooltip !== "true") return;
      if (heatmapRoot.dataset.mobileTooltipDismissed !== "true") return;

      const signature = tooltipSignature(element);
      if (signature === dismissedTooltipSignature) return;

      dismissedTooltipSignature = undefined;
      delete heatmapRoot.dataset.mobileTooltipDismissed;
    }

    function resetDismissedTooltipWhenGone() {
      if (heatmapRoot.querySelector(TOOLTIP_SELECTOR)) return;
      dismissedTooltipSignature = undefined;
      delete heatmapRoot.dataset.mobileTooltipDismissed;
    }

    function syncNode(node: Node) {
      if (!(node instanceof Element)) return;
      if (node.matches('button[data-heatmap-cell="true"]')) syncButton(node);
      if (node.matches(TOOLTIP_SELECTOR)) revealChangedTooltip(node);
      node
        .querySelectorAll('button[data-heatmap-cell="true"]')
        .forEach(syncButton);
      node.querySelectorAll(TOOLTIP_SELECTOR).forEach(revealChangedTooltip);
    }

    function dismissTooltipOnMobileScroll() {
      if (!window.matchMedia(MOBILE_QUERY).matches) return;
      const tooltip = heatmapRoot.querySelector<HTMLElement>(TOOLTIP_SELECTOR);
      if (!tooltip) return;

      dismissedTooltipSignature = tooltipSignature(tooltip);
      heatmapRoot.dataset.mobileTooltipDismissed = "true";
    }

    syncNode(heatmapRoot);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          if (record.attributeName === "title") {
            syncButton(record.target as Element);
          } else if (record.attributeName === "style") {
            revealChangedTooltip(record.target as Element);
          }
          continue;
        }

        if (record.type === "characterData") {
          const parent = record.target.parentElement?.closest(TOOLTIP_SELECTOR);
          if (parent) revealChangedTooltip(parent);
          continue;
        }

        record.addedNodes.forEach(syncNode);
        const changedTooltip =
          record.target instanceof Element
            ? record.target.closest(TOOLTIP_SELECTOR)
            : null;
        if (changedTooltip) revealChangedTooltip(changedTooltip);
        resetDismissedTooltipWhenGone();
      }
    });

    observer.observe(heatmapRoot, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["title", "style"],
    });

    window.addEventListener("scroll", dismissTooltipOnMobileScroll, {
      passive: true,
    });
    document.addEventListener("scroll", dismissTooltipOnMobileScroll, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", dismissTooltipOnMobileScroll);
      document.removeEventListener("scroll", dismissTooltipOnMobileScroll, true);
    };
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
              <span
                className="absolute inset-x-0 bottom-0 h-1"
                data-selection-floor="true"
              />
            </span>
            <span>{t("Your availability")}</span>
          </div>
        </div>
      )}
      <CoreHeatmap {...props} />
    </div>
  );
}
