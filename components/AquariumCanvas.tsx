'use client'
import { useEffect, useRef, useState } from 'react'
import { AquariumRenderer, type Camera } from '@/lib/renderer'
import { useEngine, useReducedMotion } from '@/lib/hooks'
import { getEngine } from '@/simulation/engine'
import { TANK_H, TANK_W } from '@/simulation/environment'
import { worldClock } from '@/lib/format'
import { loadPrefs, savePrefs } from '@/lib/storage'
import type { SimSpeed } from '@/types/simulation'
import { useLaunch } from './AppShell'

const MAX_ZOOM_FACTOR = 6

export function AquariumCanvas({ className = '' }: { className?: string }) {
  const engine = useEngine()
  const launch = useLaunch()
  const reduced = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<AquariumRenderer | null>(null)
  const camRef = useRef<Camera>({ x: TANK_W / 2, y: TANK_H / 2, zoom: 0.5 })
  const fitZoomRef = useRef(0.5)
  const userMovedRef = useRef(false)
  const hoverRef = useRef<string | null>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const coordRef = useRef<HTMLSpanElement>(null)
  const [panMode, setPanMode] = useState(false)
  const panModeRef = useRef(false)
  panModeRef.current = panMode

  // set up renderer, resize handling and the draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const e = getEngine()
    const prefs = loadPrefs()
    if (prefs.showNames !== undefined) e.ui.showNames = prefs.showNames
    const r = new AquariumRenderer(canvas)
    rendererRef.current = r

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      r.resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1))
      const fit = r.fitCamera()
      fitZoomRef.current = fit.zoom
      if (!userMovedRef.current) camRef.current = fit
      else camRef.current.zoom = clampZoom(camRef.current.zoom)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    if (process.env.NODE_ENV !== 'production') {
      // dev-only handle used by browser tests to locate fish on screen
      ;(window as unknown as { aquariumView: unknown }).aquariumView = {
        worldToScreen: (x: number, y: number) => {
          const p = r.worldToScreen(camRef.current, x, y)
          const rect = canvas.getBoundingClientRect()
          return { x: p.x + rect.left, y: p.y + rect.top }
        },
      }
    }

    let hudAcc = 0
    const off = e.onFrame((dt) => {
      r.update(dt || 0, e)
      const cam = camRef.current
      // camera tracking of the selected fish
      if (e.ui.track && e.ui.selectedId) {
        const f = e.byId.get(e.ui.selectedId)
        if (f) {
          const targetZoom = Math.max(cam.zoom, fitZoomRef.current * 2.2)
          cam.x += (f.pos.x - cam.x) * 0.06
          cam.y += (f.pos.y - cam.y) * 0.06
          cam.zoom += (targetZoom - cam.zoom) * 0.04
          userMovedRef.current = true
        }
      }
      r.draw(e, cam, { hoverId: hoverRef.current, showNames: e.ui.showNames })
      hudAcc += 1
      if (hudAcc > 10 && hudRef.current) {
        hudAcc = 0
        hudRef.current.textContent = `${worldClock(e.world.worldTime)} · ${e.phase} · ${e.fps} fps · ${Math.round((cam.zoom / fitZoomRef.current) * 100)}%`
      }
    })
    return () => {
      off()
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    if (rendererRef.current) rendererRef.current.reducedMotion = reduced
  }, [reduced])

  const clampZoom = (z: number) => Math.min(fitZoomRef.current * MAX_ZOOM_FACTOR, Math.max(fitZoomRef.current * 0.8, z))

  const zoomAt = (factor: number, sx?: number, sy?: number) => {
    const r = rendererRef.current
    if (!r) return
    const cam = camRef.current
    const { w, h } = r.size
    const px = sx ?? w / 2
    const py = sy ?? h / 2
    const before = r.screenToWorld(cam, px, py)
    cam.zoom = clampZoom(cam.zoom * factor)
    const after = r.screenToWorld(cam, px, py)
    cam.x += before.x - after.x
    cam.y += before.y - after.y
    clampPan()
    userMovedRef.current = true
  }

  const clampPan = () => {
    const cam = camRef.current
    cam.x = Math.min(TANK_W + 100, Math.max(-100, cam.x))
    cam.y = Math.min(TANK_H + 100, Math.max(-100, cam.y))
  }

  const fit = () => {
    const r = rendererRef.current
    if (!r) return
    camRef.current = r.fitCamera()
    userMovedRef.current = false
    if (engine) engine.ui.track = false
    engine?.notify()
  }

  // wheel zoom must be non-passive to prevent page scroll
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015))
      zoomAt(factor, ev.clientX - rect.left, ev.clientY - rect.top)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // pointer interaction: drag to pan, click to select, pinch to zoom
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ x: number; y: number; moved: boolean; pinch: number } | null>(null)

  const local = (ev: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
  }

  const onPointerDown = (ev: React.PointerEvent) => {
    canvasRef.current?.setPointerCapture(ev.pointerId)
    const p = local(ev)
    pointers.current.set(ev.pointerId, p)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      drag.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, moved: true, pinch: Math.hypot(a.x - b.x, a.y - b.y) }
    } else {
      drag.current = { x: p.x, y: p.y, moved: false, pinch: 0 }
    }
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    const r = rendererRef.current
    const e = engine
    if (!r || !e) return
    const p = local(ev)
    const cam = camRef.current
    const world = r.screenToWorld(cam, p.x, p.y)
    if (coordRef.current) coordRef.current.textContent = `x ${Math.round(world.x)}  y ${Math.round(world.y)}`
    if (pointers.current.has(ev.pointerId)) pointers.current.set(ev.pointerId, p)
    const d = drag.current
    if (d) {
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        if (d.pinch > 0) zoomAt(dist / d.pinch, mid.x, mid.y)
        cam.x -= (mid.x - d.x) / cam.zoom
        cam.y -= (mid.y - d.y) / cam.zoom
        d.x = mid.x
        d.y = mid.y
        d.pinch = dist
        return
      }
      const dx = p.x - d.x
      const dy = p.y - d.y
      if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true
      if (d.moved) {
        cam.x -= dx / cam.zoom
        cam.y -= dy / cam.zoom
        clampPan()
        d.x = p.x
        d.y = p.y
        userMovedRef.current = true
        if (e.ui.track) {
          e.ui.track = false
          e.notify()
        }
      }
      return
    }
    const f = e.fishAt(world.x, world.y, 16 / cam.zoom)
    hoverRef.current = f?.id ?? null
    if (canvasRef.current) canvasRef.current.style.cursor = panModeRef.current ? 'grab' : f ? 'pointer' : 'crosshair'
  }

  const onPointerUp = (ev: React.PointerEvent) => {
    const d = drag.current
    pointers.current.delete(ev.pointerId)
    if (pointers.current.size > 0) {
      const [rest] = [...pointers.current.values()]
      drag.current = { x: rest.x, y: rest.y, moved: true, pinch: 0 }
      return
    }
    drag.current = null
    if (!d || d.moved || panModeRef.current || !engine || !rendererRef.current) return
    const p = local(ev)
    const cam = camRef.current
    const world = rendererRef.current.screenToWorld(cam, p.x, p.y)
    const f = engine.fishAt(world.x, world.y, (ev.pointerType === 'touch' ? 28 : 16) / cam.zoom)
    engine.select(f?.id ?? null)
  }

  const cycle = (dir: 1 | -1) => {
    if (!engine) return
    const list = engine.world.fish
    if (!list.length) return
    const i = list.findIndex((f) => f.id === engine.ui.selectedId)
    const next = list[(i + dir + list.length) % list.length]
    engine.select(next.id)
  }

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (!engine) return
    const cam = camRef.current
    const step = 60 / cam.zoom
    let handled = true
    switch (ev.key) {
      case 'ArrowLeft':
        cam.x -= step
        userMovedRef.current = true
        break
      case 'ArrowRight':
        cam.x += step
        userMovedRef.current = true
        break
      case 'ArrowUp':
        cam.y -= step
        userMovedRef.current = true
        break
      case 'ArrowDown':
        cam.y += step
        userMovedRef.current = true
        break
      case '+':
      case '=':
        zoomAt(1.25)
        break
      case '-':
      case '_':
        zoomAt(0.8)
        break
      case '0':
      case 'f':
        fit()
        break
      case ' ':
        engine.setPaused(!engine.ui.paused)
        break
      case ']':
      case 'Tab':
        if (ev.key === 'Tab') {
          handled = false
          break
        }
        cycle(1)
        break
      case '[':
        cycle(-1)
        break
      case 'Escape':
        engine.select(null)
        break
      case 'n':
        toggleNames()
        break
      case 't':
        toggleTrack()
        break
      default:
        handled = false
    }
    if (handled) {
      clampPan()
      ev.preventDefault()
    }
  }

  const toggleNames = () => {
    if (!engine) return
    engine.ui.showNames = !engine.ui.showNames
    savePrefs({ showNames: engine.ui.showNames })
    engine.notify()
  }
  const toggleTrack = () => {
    if (!engine) return
    engine.ui.track = !engine.ui.track && !!engine.ui.selectedId
    engine.notify()
  }

  const ui = engine?.ui
  const selected = engine && ui?.selectedId ? engine.byId.get(ui.selectedId) : undefined
  const awake = engine ? engine.world.fish.filter((f) => f.action !== 'REST').length : 0

  return (
    <div className={`relative flex flex-col overflow-hidden border border-line bg-ink ${className}`}>
      {/* toolbar: in-flow above the tank on small screens, overlaid on larger ones */}
      <div className="relative z-10 border-b border-line p-1.5 sm:pointer-events-none sm:absolute sm:inset-x-2 sm:top-2 sm:border-0 sm:p-0">
        <div className="pointer-events-auto flex flex-wrap gap-1" role="toolbar" aria-label="World controls">
          <button className="btn" aria-pressed={panMode} onClick={() => setPanMode((p) => !p)} title="Pan mode: drag without selecting">
            pan
          </button>
          <button className="btn" onClick={() => zoomAt(0.8)} aria-label="Zoom out">
            zoom −
          </button>
          <button className="btn" onClick={() => zoomAt(1.25)} aria-label="Zoom in">
            zoom +
          </button>
          <button className="btn" onClick={fit} aria-label="Fit tank to view">
            fit
          </button>
          <span className="mx-0.5 w-px self-stretch bg-line" aria-hidden />
          <button className="btn" aria-pressed={!!ui?.paused} onClick={() => engine?.setPaused(!ui?.paused)}>
            {ui?.paused ? 'play' : 'pause'}
          </button>
          {([1, 2, 4] as SimSpeed[]).map((s) => (
            <button key={s} className="btn" aria-pressed={ui?.speed === s} onClick={() => engine?.setSpeed(s)} aria-label={`Speed ${s}x`}>
              {s}x
            </button>
          ))}
          <span className="mx-0.5 w-px self-stretch bg-line" aria-hidden />
          <button className="btn" onClick={() => engine?.feed(undefined, true)} title="Drop a pinch of food">
            feed
          </button>
          <button className="btn" aria-pressed={!!ui?.showNames} onClick={toggleNames}>
            names
          </button>
          <button className="btn" aria-pressed={!!ui?.track} disabled={!selected} onClick={toggleTrack} title="Camera follows the selected fish">
            track
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={wrapRef}
          className="absolute inset-0"
          tabIndex={0}
          role="application"
          aria-roledescription="aquarium"
          aria-label={`Live aquarium with ${engine?.world.fish.length ?? 0} fish, ${awake} awake. Arrow keys pan, plus and minus zoom, F fits, space pauses, [ and ] select fish, Escape clears selection.`}
          onKeyDown={onKeyDown}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => (hoverRef.current = null)}
          />
        </div>

        {/* HUD */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-0.5 text-[10px] tracking-wider text-dim">
          <span ref={coordRef} aria-hidden className="hidden sm:inline">
            x —  y —
          </span>
          <span ref={hudRef} aria-hidden />
        </div>
        {!selected && (
          <div className="pointer-events-none absolute right-2 bottom-2 hidden text-[10px] tracking-wider text-dim sm:block">click a fish to inspect · drag to pan · scroll to zoom</div>
        )}
        {engine && engine.world.fish.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="panel max-w-[340px] p-4 text-center text-[12px]">
              <pre aria-hidden className="mb-2 text-aqua">{'  ><(((°>\n  ?  ?  ?'}</pre>
              <p className="text-fg">the tank is empty.</p>
              <p className="mt-1 text-dim">every fish here is a coin. launch one and it gets dropped in with the brain you choose.</p>
              <button className="btn mt-3 border-aqua! text-aqua! hover:bg-aqua! hover:text-ink!" onClick={launch.open}>
                + launch the first coin
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
