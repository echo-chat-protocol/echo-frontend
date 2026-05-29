/**
 * Reusable spinner.
 *
 * Variants:
 *   - page: full-screen loading overlay (default for Suspense) — a big pulsating
 *           ECHO logo centred on screen with a label underneath. No wheel.
 *   - inline: small inline spinner wheel
 *
 * Usage:
 *   <Spinner />                       ← full-page, "Loading…"
 *   <Spinner label="Decrypting…" />   ← full-page, custom label
 *   <Spinner variant="inline" />      ← small
 */
export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className='flex flex-col items-center gap-6'>
      <img
        src='/echo-logo.svg'
        alt='ECHO'
        className='h-40 w-40 object-contain animate-pulse drop-shadow-[0_0_45px_rgba(168,85,247,0.55)]'
      />
      <p className='animate-pulse text-base tracking-wide text-zinc-400'>{label}</p>
    </div>
  )
}

export default function Spinner({ variant = 'page', className = '', label = 'Loading…' }) {
  if (variant === 'inline') {
    return (
      <span
        className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`}
        aria-label='Loading'
      />
    )
  }

  return (
    <div
      className='min-h-screen bg-black flex items-center justify-center'
      aria-label='Loading page'
    >
      <PageLoader label={label} />
    </div>
  )
}
