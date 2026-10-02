'use client'
import Link from 'next/link'
import { useEngine } from '@/lib/hooks'
import { AquariumCanvas } from '@/components/AquariumCanvas'
import { StatsBar } from '@/components/StatsBar'
import { FishInspector } from '@/components/FishInspector'
import { ActivityFeed } from '@/components/ActivityFeed'
import { ThoughtStream } from '@/components/ThoughtStream'
import { RecentlyIntroduced } from '@/components/RecentlyIntroduced'
import { ExploreFish } from '@/components/ExploreFish'
import { TankTalk } from '@/components/TankTalk'

export default function WorldPage() {
  const engine = useEngine()
  const sel = engine?.ui.selectedId ? engine.byId.get(engine.ui.selectedId) : undefined
  const absence = engine?.lastAbsence

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <h1 className="text-[17px] font-bold tracking-[0.2em] text-fg sm:text-[26px] sm:tracking-[0.28em]">EVERY FISH HAS A MIND.</h1>
        <p className="text-[11px] text-dim">
          {absence ? (
            <span className="text-aqua">welcome back. the tank kept going while you were away.</span>
          ) : (
            'a persistent tank of autonomous fish. leave it open. come back tomorrow.'
          )}
        </p>
      </div>

      <StatsBar />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <AquariumCanvas className="h-[calc(52vw+112px)] sm:h-[58vh] sm:min-h-[340px] lg:h-[calc(100vh-215px)] lg:max-h-[860px] lg:min-h-[480px]" />
        <aside className="hidden min-h-0 flex-col gap-3 lg:flex lg:h-[calc(100vh-215px)] lg:max-h-[860px] lg:min-h-[480px]" aria-label="Inspector and activity">
          <div className="panel scroll-thin min-h-0 flex-[3] overflow-y-auto p-3">
            {sel && engine ? (
              <FishInspector fish={sel} engine={engine} onClose={() => engine.select(null)} />
            ) : (
              <>
                <TankTalk />
                <div className="label mt-4 mb-2 border-t border-line pt-3">thought stream</div>
                <ThoughtStream count={4} />
              </>
            )}
          </div>
          <div className="panel flex min-h-0 flex-[2] flex-col p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="label">live activity</span>
              <Link href="/activity" className="text-[11px] text-dim hover:text-aqua">
                all →
              </Link>
            </div>
            <div className="scroll-thin min-h-0 overflow-y-auto">
              <ActivityFeed limit={40} showCategory={false} />
            </div>
          </div>
        </aside>
      </div>

      {/* mobile: inspector as a bottom sheet */}
      {sel && engine && (
        <div className="panel sheet-up scroll-thin fixed inset-x-0 bottom-0 z-40 max-h-[48vh] overflow-y-auto bg-panel! p-3 lg:hidden" role="dialog" aria-label={`${sel.name} details`}>
          <FishInspector fish={sel} engine={engine} onClose={() => engine.select(null)} />
        </div>
      )}
      <div className="panel p-3 lg:hidden">
        <TankTalk />
      </div>
      <details className="panel p-3 lg:hidden" open>
        <summary className="label cursor-pointer">live activity</summary>
        <ActivityFeed limit={14} showCategory={false} className="mt-2" />
      </details>

      <div className="pt-4">
        <RecentlyIntroduced />
      </div>
      <div className="pt-4">
        <ExploreFish limit={12} />
      </div>
    </div>
  )
}
