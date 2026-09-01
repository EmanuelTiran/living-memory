const REDUCED_MOTION_QUERY =
  '(prefers-reduced-motion: reduce)'
const TARGET_ARRIVAL_CLASS =
  'aura-target-arrival'

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.(
      REDUCED_MOTION_QUERY,
    ).matches === true
  )
}

function markTargetArrival(target) {
  target.classList.remove(
    TARGET_ARRIVAL_CLASS,
  )

  window.requestAnimationFrame(() => {
    if (!target.isConnected) {
      return
    }

    function handleAnimationEnd(event) {
      if (
        event.target !== target ||
        event.animationName !==
          'aura-target-arrive'
      ) {
        return
      }

      target.classList.remove(
        TARGET_ARRIVAL_CLASS,
      )
      target.removeEventListener(
        'animationend',
        handleAnimationEnd,
      )
    }

    target.classList.add(
      TARGET_ARRIVAL_CLASS,
    )
    target.addEventListener(
      'animationend',
      handleAnimationEnd,
    )
  })
}

export function revealAuraTarget(
  target,
  {
    block = 'center',
    smooth = true,
  } = {},
) {
  if (!target) {
    return
  }

  const reducedMotion =
    prefersReducedMotion()

  target.scrollIntoView({
    behavior:
      smooth && !reducedMotion
        ? 'smooth'
        : 'auto',
    block,
  })

  if (reducedMotion) {
    target.classList.remove(
      TARGET_ARRIVAL_CLASS,
    )
    return
  }

  markTargetArrival(target)
}
