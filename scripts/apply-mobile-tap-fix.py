from pathlib import Path

path = Path(__file__).resolve().parents[1] / "apps/web/src/components/meetings/interactive-availability-heatmap.tsx"
text = path.read_text(encoding="utf-8")

old_ref = '''  const dragging = useRef(false);\n  const touchedSlot = useRef<string>();\n  const touchGesture = useRef<TouchGesture>();\n'''
new_ref = '''  const dragging = useRef(false);\n  const touchedSlot = useRef<string | undefined>(undefined);\n  const touchGesture = useRef<TouchGesture | undefined>(undefined);\n  const suppressNextMobileClick = useRef(false);\n'''
if old_ref not in text:
    raise RuntimeError("touch state refs anchor missing")
text = text.replace(old_ref, new_ref, 1)

old_finish = '''        const distance = Math.hypot(\n          event.clientX - touch.startX,\n          event.clientY - touch.startY,\n        );\n        if (!touch.longPressTriggered && !touch.dragging && distance < 8) {\n          if (manualMeetingMode) {\n            chooseManualTime(touch.cell);\n          } else if (!editable || mobileMode === "view") {\n            const element = document.querySelector<HTMLElement>(\n              `[data-slot-start="${CSS.escape(touch.cell.datetimeStart)}"]`,\n            );\n            const box = element?.getBoundingClientRect();\n            inspect(\n              touch.cell,\n              box ? box.left + box.width / 2 : event.clientX,\n              box?.top ?? event.clientY,\n            );\n          } else {\n            onToggleSlot(touch.cell.datetimeStart);\n          }\n        }\n'''
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

keyboard_anchor = '''  function keyboardActivate(cell: HeatmapCellDto) {\n    if (manualMeetingMode) {\n      chooseManualTime(cell);\n      return;\n    }\n    if (canEditAvailability) {\n      onToggleSlot(cell.datetimeStart);\n      return;\n    }\n    const element = document.querySelector<HTMLElement>(\n      `[data-slot-start="${CSS.escape(cell.datetimeStart)}"]`,\n    );\n    const box = element?.getBoundingClientRect();\n    inspect(\n      cell,\n      box ? box.left + box.width / 2 : 160,\n      box?.top ?? 160,\n    );\n  }\n'''
click_handler = keyboard_anchor + '''\n  function activateFromClick(cell: HeatmapCellDto, detail: number) {\n    if (detail === 0) {\n      keyboardActivate(cell);\n      return;\n    }\n    if (!isMobile) return;\n    if (suppressNextMobileClick.current) {\n      suppressNextMobileClick.current = false;\n      return;\n    }\n    keyboardActivate(cell);\n  }\n'''
if keyboard_anchor not in text:
    raise RuntimeError("keyboard activation anchor missing")
text = text.replace(keyboard_anchor, click_handler, 1)

old_row_call = '''              onHoverCell={inspect}\n              onKeyboardActivate={keyboardActivate}\n              onLeaveCell={clearInspection}\n'''
new_row_call = '''              onHoverCell={inspect}\n              onClickCell={activateFromClick}\n              onKeyboardActivate={keyboardActivate}\n              onLeaveCell={clearInspection}\n'''
if old_row_call not in text:
    raise RuntimeError("row click callback anchor missing")
text = text.replace(old_row_call, new_row_call, 1)

old_destructure = '''  onFocusCell,\n  onHoverCell,\n  onKeyboardActivate,\n  onLeaveCell,\n'''
new_destructure = '''  onFocusCell,\n  onHoverCell,\n  onClickCell,\n  onKeyboardActivate,\n  onLeaveCell,\n'''
if old_destructure not in text:
    raise RuntimeError("row destructure anchor missing")
text = text.replace(old_destructure, new_destructure, 1)

old_type = '''  onFocusCell: (cell: HeatmapCellDto, x: number, y: number) => void;\n  onHoverCell: (cell: HeatmapCellDto, x: number, y: number) => void;\n  onKeyboardActivate: (cell: HeatmapCellDto) => void;\n'''
new_type = '''  onFocusCell: (cell: HeatmapCellDto, x: number, y: number) => void;\n  onHoverCell: (cell: HeatmapCellDto, x: number, y: number) => void;\n  onClickCell: (cell: HeatmapCellDto, detail: number) => void;\n  onKeyboardActivate: (cell: HeatmapCellDto) => void;\n'''
if old_type not in text:
    raise RuntimeError("row callback type anchor missing")
text = text.replace(old_type, new_type, 1)

old_click = '''                  onClick={(event) => {\n                    if (event.detail === 0) onKeyboardActivate(cell);\n                  }}\n'''
new_click = '''                  onClick={(event) =>\n                    onClickCell(cell, event.detail)\n                  }\n'''
if old_click not in text:
    raise RuntimeError("cell click handler anchor missing")
text = text.replace(old_click, new_click, 1)

path.write_text(text, encoding="utf-8")
print("mobile taps now route through a parent-owned click handler; drag and hold suppress native click")
