'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useEngine } from '@/lib/hooks'
import { getAudio } from '@/lib/audio'
import { savePrefs } from '@/lib/storage'

const LINKS = [
  { href: '/', label: 'world' },
  { href: '/fish', label: 'fish' },
  { href: '/schools', label: 'schools' },
  { href: '/species', label: 'species' },
  { href: '/talk', label: 'talk' },
  { href: '/activity', label: 'activity' },
  { href: '/about', label: 'about' },
]

export function Navigation({ onAdd }: { onAdd: () => void }) {
  const path = usePathname()
  const engine = useEngine()
  const [sound, setSound] = useState(false)

  const toggleSound = async () => {
    const a = getAudio()
    if (sound) {
      a.stop()
      setSound(false)
      savePrefs({ sound: false })
    } else {
      await a.start()
      setSound(true)
      savePrefs({ sound: true })
    }
  }

  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href))

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:flex-nowrap sm:gap-6 sm:px-5">
        <Link href="/" className="flex shrink-0 items-baseline gap-2 text-fg hover:text-aqua" aria-label="Aquarium home">
          <span className="text-[15px] font-bold tracking-[0.3em]">AQUARIUM</span>
          <span aria-hidden className="hidden text-[11px] text-aqua-dim md:inline">
            {'><(((°>'}
          </span>
        </Link>
        <nav aria-label="Primary" className="scroll-thin order-last -mx-1 flex w-full min-w-0 gap-1 overflow-x-auto px-1 text-[12px] sm:order-none sm:w-auto sm:flex-1 sm:gap-3">
          {LINKS.map((l, i) => (
            <span key={l.href} className="flex shrink-0 items-center gap-1 sm:gap-3">
              {i > 0 && (
                <span aria-hidden className="text-faint">
                  /
                </span>
              )}
              <Link
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`px-0.5 py-1 ${isActive(l.href) ? 'text-aqua underline decoration-aqua/50 underline-offset-4' : 'text-dim hover:text-fg'}`}
              >
                {l.label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          <span className="hidden items-center gap-1.5 text-[10px] tracking-widest text-dim lg:flex" aria-hidden>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${engine?.ui.paused ? 'bg-warn' : 'bg-good blink'}`} />
            {engine?.ui.paused ? 'PAUSED' : 'LIVE'}
          </span>
          <button className="btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Mute ambient sound' : 'Play ambient sound'}>
            snd {sound ? 'on' : 'off'}
          </button>
          <button onClick={onAdd} className="btn border-aqua-dim! text-aqua! hover:bg-aqua! hover:text-ink!">
            + add a fish
          </button>
        </div>
      </div>
    </header>
  )
}
