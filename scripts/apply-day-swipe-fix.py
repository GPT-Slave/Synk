from pathlib import Path

path = Path(__file__).resolve().parents[1] / "apps/web/src/components/meetings/interactive-availability-heatmap.tsx"
text = path.read_text(encoding="utf-8")

ref_anchor = '  const gesture = useRef<{ pointerId: number; x: number }>();\n'
if ref_anchor not in text:
    raise RuntimeError("day swipe gesture ref anchor missing")
text = text.replace(
    ref_anchor,
    ref_anchor + '  const touchStartX = useRef<number | undefined>(undefined);\n',
    1,
)

old = '''        onPointerDown={(event) => {\n          gesture.current = { pointerId: event.pointerId, x: event.clientX };\n          event.currentTarget.setPointerCapture(event.pointerId);\n        }}\n        onPointerUp={(event) => {\n          const current = gesture.current;\n          gesture.current = undefined;\n          if (!current || current.pointerId !== event.pointerId) return;\n          const delta = event.clientX - current.x;\n          if (delta <= -DAY_SWIPE_THRESHOLD) next();\n          if (delta >= DAY_SWIPE_THRESHOLD) previous();\n        }}\n'''
new = '''        onPointerDown={(event) => {\n          gesture.current = { pointerId: event.pointerId, x: event.clientX };\n          event.currentTarget.setPointerCapture(event.pointerId);\n        }}\n        onPointerMove={(event) => {\n          const current = gesture.current;\n          if (!current || current.pointerId !== event.pointerId) return;\n          const delta = event.clientX - current.x;\n          if (delta <= -DAY_SWIPE_THRESHOLD) {\n            gesture.current = undefined;\n            touchStartX.current = undefined;\n            next();\n          } else if (delta >= DAY_SWIPE_THRESHOLD) {\n            gesture.current = undefined;\n            touchStartX.current = undefined;\n            previous();\n          }\n        }}\n        onPointerUp={(event) => {\n          const current = gesture.current;\n          gesture.current = undefined;\n          if (!current || current.pointerId !== event.pointerId) return;\n          const delta = event.clientX - current.x;\n          if (delta <= -DAY_SWIPE_THRESHOLD) next();\n          if (delta >= DAY_SWIPE_THRESHOLD) previous();\n        }}\n        onTouchStart={(event) => {\n          touchStartX.current = event.touches[0]?.clientX;\n        }}\n        onTouchMove={(event) => {\n          const startX = touchStartX.current;\n          const currentX = event.touches[0]?.clientX;\n          if (startX === undefined || currentX === undefined) return;\n          const delta = currentX - startX;\n          if (delta <= -DAY_SWIPE_THRESHOLD) {\n            touchStartX.current = undefined;\n            gesture.current = undefined;\n            next();\n          } else if (delta >= DAY_SWIPE_THRESHOLD) {\n            touchStartX.current = undefined;\n            gesture.current = undefined;\n            previous();\n          }\n        }}\n        onTouchEnd={() => {\n          touchStartX.current = undefined;\n        }}\n'''
if old not in text:
    raise RuntimeError("day swipe handler anchor missing")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("dedicated day swipe supports native touch plus pointer input")
