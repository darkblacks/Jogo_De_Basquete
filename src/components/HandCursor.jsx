export function HandCursor({ enabled, cursor, handState }) {
  if (!enabled) return null

  return (
    <div
      className={`hand-cursor ${handState === 'closed' ? 'closed' : 'open'}`}
      style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }}
      aria-hidden="true"
    >
      <span>{handState === 'closed' ? '✊' : '🖐️'}</span>
    </div>
  )
}
