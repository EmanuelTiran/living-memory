import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP_ID = 'aura-active-tooltip'
const TOOLTIP_SELECTOR = '[data-aura-tooltip]'
const HOVER_DELAY_MS = 240
const VIEWPORT_PADDING = 12
const TRIGGER_GAP = 10

function findTrigger(target) {
  return target instanceof Element
    ? target.closest(TOOLTIP_SELECTOR)
    : null
}

function isInside(trigger, target) {
  return (
    target instanceof Node &&
    trigger.contains(target)
  )
}

function canHover() {
  return (
    window.matchMedia?.(
      '(hover: hover) and (pointer: fine)',
    ).matches === true
  )
}

function calculatePosition(trigger, tooltip) {
  const triggerRect =
    trigger.getBoundingClientRect()
  const tooltipRect =
    tooltip.getBoundingClientRect()
  const spaceAbove =
    triggerRect.top -
    VIEWPORT_PADDING -
    TRIGGER_GAP
  const spaceBelow =
    window.innerHeight -
    triggerRect.bottom -
    VIEWPORT_PADDING -
    TRIGGER_GAP
  const placement =
    spaceAbove >= tooltipRect.height ||
    spaceAbove >= spaceBelow
      ? 'top'
      : 'bottom'
  const triggerCenter =
    triggerRect.left + triggerRect.width / 2
  const maxLeft = Math.max(
    VIEWPORT_PADDING,
    window.innerWidth -
      tooltipRect.width -
      VIEWPORT_PADDING,
  )
  const left = Math.min(
    Math.max(
      triggerCenter - tooltipRect.width / 2,
      VIEWPORT_PADDING,
    ),
    maxLeft,
  )

  return {
    placement,
    left,
    top:
      placement === 'top'
        ? triggerRect.top -
          tooltipRect.height -
          TRIGGER_GAP
        : triggerRect.bottom + TRIGGER_GAP,
    arrowLeft: Math.min(
      Math.max(triggerCenter - left, 14),
      tooltipRect.width - 14,
    ),
  }
}

export default function AuraTooltipLayer() {
  const [active, setActive] = useState(null)
  const [position, setPosition] =
    useState(null)
  const activeRef = useRef(null)
  const hoverTimerRef = useRef(null)
  const suppressFocusUntilRef = useRef(0)
  const tooltipRef = useRef(null)

  const clearHoverTimer = useCallback(() => {
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }, [])

  const hide = useCallback(() => {
    clearHoverTimer()
    activeRef.current = null
    setActive(null)
    setPosition(null)
  }, [clearHoverTimer])

  const show = useCallback(
    (trigger, delayed = false) => {
      const text = trigger
        ?.getAttribute('data-aura-tooltip')
        ?.trim()

      if (!text || !trigger.isConnected) {
        return
      }

      clearHoverTimer()

      const open = () => {
        if (!trigger.isConnected) {
          return
        }

        const next = { text, trigger }
        activeRef.current = next
        setPosition(null)
        setActive(next)
      }

      if (delayed) {
        hoverTimerRef.current =
          window.setTimeout(
            open,
            HOVER_DELAY_MS,
          )
      } else {
        open()
      }
    },
    [clearHoverTimer],
  )

  useLayoutEffect(() => {
    const current = activeRef.current
    const tooltip = tooltipRef.current

    if (!active) {
      return
    }

    if (!current?.trigger.isConnected || !tooltip) {
      hide()
      return
    }

    setPosition(
      calculatePosition(
        current.trigger,
        tooltip,
      ),
    )
  }, [active, hide])

  useEffect(() => {
    const trigger = active?.trigger

    if (!trigger) {
      return undefined
    }

    const ids = new Set(
      (trigger.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter(Boolean),
    )

    ids.add(TOOLTIP_ID)
    trigger.setAttribute(
      'aria-describedby',
      [...ids].join(' '),
    )

    return () => {
      const remainingIds = (
        trigger.getAttribute('aria-describedby') ?? ''
      )
        .split(/\s+/)
        .filter(
          (id) => id && id !== TOOLTIP_ID,
        )

      if (remainingIds.length > 0) {
        trigger.setAttribute(
          'aria-describedby',
          remainingIds.join(' '),
        )
      } else {
        trigger.removeAttribute(
          'aria-describedby',
        )
      }
    }
  }, [active])

  useEffect(() => {
    function handlePointerOver(event) {
      if (!canHover()) {
        return
      }

      const trigger = findTrigger(event.target)

      if (
        trigger &&
        !isInside(trigger, event.relatedTarget)
      ) {
        show(trigger, true)
      }
    }

    function handlePointerOut(event) {
      const trigger = findTrigger(event.target)

      if (
        !trigger ||
        isInside(trigger, event.relatedTarget)
      ) {
        return
      }

      clearHoverTimer()

      if (!isInside(trigger, document.activeElement)) {
        hide()
      }
    }

    function handleFocusIn(event) {
      if (
        Date.now() <
        suppressFocusUntilRef.current
      ) {
        return
      }

      const trigger = findTrigger(event.target)

      if (trigger) {
        show(trigger)
      }
    }

    function handleFocusOut(event) {
      const trigger = findTrigger(event.target)

      if (
        !trigger ||
        isInside(trigger, event.relatedTarget) ||
        (canHover() && trigger.matches(':hover'))
      ) {
        return
      }

      hide()
    }

    function handlePointerDown() {
      suppressFocusUntilRef.current =
        Date.now() + 500
      hide()
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        hide()
      }
    }

    const documentListeners = [
      ['pointerover', handlePointerOver],
      ['pointerout', handlePointerOut],
      ['focusin', handleFocusIn],
      ['focusout', handleFocusOut],
      ['keydown', handleKeyDown],
    ]
    const windowListeners = [
      ['resize', hide],
      ['scroll', hide, true],
      ['popstate', hide],
      ['hashchange', hide],
    ]

    documentListeners.forEach(
      ([name, listener]) => {
        document.addEventListener(name, listener)
      },
    )
    document.addEventListener(
      'pointerdown',
      handlePointerDown,
      true,
    )
    document.addEventListener('click', hide, true)
    windowListeners.forEach(
      ([name, listener, capture = false]) => {
        window.addEventListener(
          name,
          listener,
          capture,
        )
      },
    )

    return () => {
      clearHoverTimer()
      documentListeners.forEach(
        ([name, listener]) => {
          document.removeEventListener(
            name,
            listener,
          )
        },
      )
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
        true,
      )
      document.removeEventListener(
        'click',
        hide,
        true,
      )
      windowListeners.forEach(
        ([name, listener, capture = false]) => {
          window.removeEventListener(
            name,
            listener,
            capture,
          )
        },
      )
    }
  }, [clearHoverTimer, hide, show])

  if (!active) {
    return null
  }

  return createPortal(
    <div
      ref={tooltipRef}
      id={TOOLTIP_ID}
      className="aura-tooltip"
      role="tooltip"
      data-placement={
        position?.placement ?? 'top'
      }
      data-positioned={Boolean(position)}
      style={
        position
          ? {
              '--aura-tooltip-arrow-left': `${position.arrowLeft}px`,
              left: `${position.left}px`,
              top: `${position.top}px`,
            }
          : undefined
      }
    >
      {active.text}
      <span
        className="aura-tooltip-arrow"
        aria-hidden="true"
      />
    </div>,
    document.body,
  )
}
