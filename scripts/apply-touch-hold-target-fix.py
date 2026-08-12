from pathlib import Path

path = Path(__file__).resolve().parents[1] / "apps/web/src/components/meetings/interactive-availability-heatmap.tsx"
text = path.read_text(encoding="utf-8")

old = '''    if (event.pointerType === "touch") {\n      clearHoldTimer();\n      suppressNextMobileClick.current = false;\n      const gesture: TouchGesture = {\n'''
new = '''    if (event.pointerType === "touch") {\n      clearHoldTimer();\n      suppressNextMobileClick.current = false;\n      const target = event.currentTarget;\n      const gesture: TouchGesture = {\n'''
if old not in text:
    raise RuntimeError("touch-start target anchor missing")
text = text.replace(old, new, 1)

old_timer = '''        const box = event.currentTarget.getBoundingClientRect();\n        inspect(cell, box.left + box.width / 2, box.top);\n'''
new_timer = '''        const box = target.getBoundingClientRect();\n        inspect(cell, box.left + box.width / 2, box.top);\n'''
if old_timer not in text:
    raise RuntimeError("long-press async currentTarget anchor missing")
text = text.replace(old_timer, new_timer, 1)

path.write_text(text, encoding="utf-8")
print("long press now captures its DOM target before the async hold timer")
