from pathlib import Path

path = Path(__file__).resolve().parents[1] / "apps/web/src/components/meetings/interactive-availability-heatmap.tsx"
text = path.read_text(encoding="utf-8")

old_ref = '''  const dragging = useRef(false);\n  const touchedSlot = useRef<string | undefined>(undefined);\n  const touchGesture = useRef<TouchGesture | undefined>(undefined);\n'''
new_ref = '''  const dragging = useRef(false);\n  const touchedSlot = useRef<string | undefined>(undefined);\n  const touchGesture = useRef<TouchGesture | undefined>(undefined);\n  const suppressNextMobileClick = useRef(false);\n'''
if old_ref not in text:
    raise RuntimeError("touch state refs anchor missing")
text = text.replace(old_ref, new_ref, 1)

old_finish = '''        if (!touch.longPressTriggered && !touch.dragging && distance < 8) {\n          if (manualMeetingMode) {\n            chooseManualTime(touch.cell);\n          } else if (!editable || mobileMode === "view") {\n            const element = document.querySelector<HTMLElement>(\n              `[data-slot-start="${CSS.escape(touch.cell.datetimeStart)}"]`,\n            );\n            const box = element?.getBoundingClientRect();\n            inspect(\n              touch.cell,\n              box ? box.left + box.width / 2 : event.clientX,\n              box?.top ?? event.clientY,\n            );\n          } else {\n            onToggleSlot(touch.cell.datetimeStart);\n          }\n        }\n'''
if old_finish not in text:
    raise RuntimeError("touch pointerup tap block missing")
text = text.replace(old_finish, '', 1)

old_touch_start = '''    if (event.pointerType === "touch") {\n      clearHoldTimer();\n      const gesture: TouchGesture = {\n'''
new_touch_start = '''    if (event.pointerType === "touch") {\n      clearHoldTimer();\n      suppressNextMobileClick.current = false;\n      const gesture: TouchGesture = {\n'''
if old_touch_start not in text:
    raise RuntimeError("touch start anchor missing")
text = text.replace(old_touch_start, new_touch_start, 1)

old_hold = '''        current.longPressTriggered = true;\n        const box = event.currentTarget.getBoundingClientRect();\n        inspect(cell, box.left + box.width / 2, box.top);\n'''
new_hold = '''        current.longPressTriggered = true;\n        suppressNextMobileClick.current = true;\n        const box = event.currentTarget.getBoundingClientRect();\n        inspect(cell, box.left + box.width / 2, box.top);\n'''
if old_hold not in text:
    raise RuntimeError("long press anchor missing")
text = text.replace(old_hold, new_hold, 1)

old_drag = '''        touch.dragging = true;\n        dragging.current = true;\n        touchedSlot.current = undefined;\n        applySlot(touch.cell.datetimeStart);\n'''
new_drag = '''        touch.dragging = true;\n        suppressNextMobileClick.current = true;\n        dragging.current = true;\n        touchedSlot.current = undefined;\n        applySlot(touch.cell.datetimeStart);\n'''
if old_drag not in text:
    raise RuntimeError("touch drag anchor missing")
text = text.replace(old_drag, new_drag, 1)

old_click = '''                  onClick={(event) => {\n                    if (event.detail === 0) onKeyboardActivate(cell);\n                  }}\n'''
new_click = '''                  onClick={(event) => {\n                    if (event.detail === 0) {\n                      onKeyboardActivate(cell);\n                      return;\n                    }\n                    if (!isMobile) return;\n                    if (suppressNextMobileClick.current) {\n                      suppressNextMobileClick.current = false;\n                      return;\n                    }\n                    onKeyboardActivate(cell);\n                  }}\n'''
if old_click not in text:
    raise RuntimeError("cell click handler anchor missing")
text = text.replace(old_click, new_click, 1)

path.write_text(text, encoding="utf-8")
print("mobile taps now use native click; drag and long-hold suppress the following click")
