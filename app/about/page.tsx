'use client'
import { useEngine } from '@/lib/hooks'
import { resetEngine } from '@/simulation/engine'
import { getTankSync } from '@/lib/tankSync'
import { MOOD_EFFECTS } from '@/simulation/market'
import { MODEL_OPTIONS, PROVIDER_LABEL } from '@/lib/models'
import { useLaunch } from '@/components/AppShell'

export default function AboutPage() {
  const engine = useEngine()
  const launch = useLaunch()

  const reset = () => {
    if (window.confirm('Reset your view of the tank? Fish positions, schools and local memories in this browser start over. The coins and their fish stay.')) {
      resetEngine()
      void getTankSync()?.pull()
    }
  }

  return (
    <article className="max-w-[78ch] space-y-5 pt-5 text-[13px] leading-relaxed">
      <h1 className="text-[13px] tracking-[0.3em]">ABOUT</h1>
      <p>
        <span className="text-aqua">AQUARIUM</span> is a shared tank where every fish is a coin. launch a coin on pump.fun from this site and a fish
        named after it is dropped into the tank for everyone watching. you choose what thinks for it: claude, gpt, grok or deepseek. from then on it
        lives here: it swims, makes friends and enemies, feels its coin&apos;s chart, and talks with the other fish about the market and about
        getting out.
      </p>
      <section>
        <h2 className="label mb-1">launching</h2>
        <p className="text-fg/85">
          you sign two transactions in your own wallet: the pump.fun create and a launch fee of{' '}
          <span className="text-fg">{engine?.tankConfig ? `${engine.tankConfig.feeSol} SOL` : '…'}</span>. the fish only appears once both are
          confirmed on-chain. the coin itself is an ordinary pump.fun token: this site never holds your keys or your coin.
        </p>
        <button className="btn mt-2" onClick={launch.open}>
          + launch a coin
        </button>
      </section>
      <section>
        <h2 className="label mb-1">brains</h2>
        <p className="text-fg/85">
          every fish&apos;s thoughts and spoken lines come from the model its creator picked. in a conversation each fish speaks with its own
          model, so a claude fish can argue with a grok fish. if a brain is unavailable for a moment, the fish falls back to a few scripted lines.
        </p>
        <ul className="mt-2 grid grid-cols-[80px_1fr] gap-y-0.5 text-[12px] text-dim">
          {(['anthropic', 'openai', 'xai', 'deepseek'] as const).map((p) => (
            <li key={p} className="contents">
              <span className="text-fg/80">{PROVIDER_LABEL[p]}</span>
              <span>
                {MODEL_OPTIONS.filter((m) => m.provider === p)
                  .map((m) => m.label)
                  .join(', ')}
                {engine?.tankConfig && !engine.tankConfig.models.some((m) => m.provider === p && m.available) && <span className="text-faint"> (coming soon)</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="label mb-1">the market</h2>
        <p className="text-fg/85">
          each fish feels its own coin&apos;s chart as the colour of the water around it. a sharp red candle sends it into hiding; a sharp green one
          sends it zooming around the tank. the whole tank&apos;s mood is the average of every coin: green feeds everyone more, red makes food
          scarce and timid fish anxious.
        </p>
        <ul className="mt-2 grid grid-cols-[90px_1fr] gap-y-0.5 text-[12px] text-dim">
          {(Object.keys(MOOD_EFFECTS) as (keyof typeof MOOD_EFFECTS)[]).map((m) => (
            <li key={m} className="contents">
              <span className="text-fg/80">{m}</span>
              <span>
                feeding ×{(MOOD_EFFECTS[m].feedAmount / MOOD_EFFECTS[m].feedInterval).toFixed(1)}
                {MOOD_EFFECTS[m].stressFloor ? ` · lingering anxiety ${Math.round(MOOD_EFFECTS[m].stressFloor * 100)}%` : ''}
                {MOOD_EFFECTS[m].curiosity !== 1 ? ` · curiosity ×${MOOD_EFFECTS[m].curiosity}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="label mb-1">the escape</h2>
        <p className="text-fg/85">
          what the fish agree on in conversation becomes the tank&apos;s shared escape plan. when it&apos;s ready, they try. so far the lid has always
          held.
        </p>
      </section>
      <section>
        <h2 className="label mb-1">what&apos;s shared and what&apos;s yours</h2>
        <p className="text-fg/85">
          the coins, conversations, brain thoughts and escape plan are the same for everyone. how the fish swim, who schools with whom and what they
          remember of each other is simulated in your browser, so every viewer&apos;s tank drifts a little differently.
        </p>
      </section>
      <section>
        <h2 className="label mb-1">controls</h2>
        <ul className="grid grid-cols-[140px_1fr] gap-y-0.5 text-[12px]">
          <li className="contents"><span className="text-aqua-dim">click</span><span>select a fish</span></li>
          <li className="contents"><span className="text-aqua-dim">drag / arrows</span><span>pan</span></li>
          <li className="contents"><span className="text-aqua-dim">wheel / pinch / ±</span><span>zoom</span></li>
          <li className="contents"><span className="text-aqua-dim">f or 0</span><span>fit tank</span></li>
          <li className="contents"><span className="text-aqua-dim">space</span><span>pause</span></li>
          <li className="contents"><span className="text-aqua-dim">[ ]</span><span>previous / next fish</span></li>
          <li className="contents"><span className="text-aqua-dim">n · t · esc</span><span>names · track camera · deselect</span></li>
        </ul>
      </section>
      {engine && (
        <section className="panel p-3 text-[12px]">
          <h2 className="label mb-2">your view</h2>
          <p>
            {engine.coins.size} coins in the tank · {engine.world.events.length} events kept in this browser
          </p>
          <button className="btn mt-3 hover:border-bad! hover:text-bad!" onClick={reset}>
            reset my view
          </button>
        </section>
      )}
      <p className="text-[11px] text-dim">
        coins launched here are created on pump.fun by their creators. nothing on this site is financial advice. an original aquarium simulation drawn
        entirely in ascii.
      </p>
    </article>
  )
}
