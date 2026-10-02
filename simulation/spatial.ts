import type { Fish } from '@/types/fish'

/** Uniform grid spatial hash, rebuilt each step, for neighbor queries. */
export class SpatialHash {
  private cells = new Map<number, Fish[]>()
  constructor(private cell = 120) {}

  private key(cx: number, cy: number) {
    return cx * 4096 + cy
  }

  rebuild(fish: Fish[]) {
    this.cells.clear()
    for (const f of fish) {
      const k = this.key(Math.floor(f.pos.x / this.cell), Math.floor(f.pos.y / this.cell))
      let arr = this.cells.get(k)
      if (!arr) {
        arr = []
        this.cells.set(k, arr)
      }
      arr.push(f)
    }
  }

  query(x: number, y: number, r: number, out: Fish[] = []): Fish[] {
    out.length = 0
    const r2 = r * r
    const x0 = Math.floor((x - r) / this.cell)
    const x1 = Math.floor((x + r) / this.cell)
    const y0 = Math.floor((y - r) / this.cell)
    const y1 = Math.floor((y + r) / this.cell)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy))
        if (!arr) continue
        for (const f of arr) {
          const dx = f.pos.x - x
          const dy = f.pos.y - y
          if (dx * dx + dy * dy <= r2) out.push(f)
        }
      }
    }
    return out
  }
}
