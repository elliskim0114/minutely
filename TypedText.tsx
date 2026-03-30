import { useState, useEffect, useRef } from 'react'

interface Props {
  text: string
  speed?: number   // ms per character
  delay?: number   // ms before starting
  cursor?: boolean // show blinking cursor while typing
  className?: string
}

/**
 * Renders text with a character-by-character typewriter effect.
 * Re-triggers whenever `text` changes.
 */
export default function TypedText({ text, speed = 16, delay = 0, cursor = true, className }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    if (ivRef.current) clearInterval(ivRef.current)
    if (toRef.current) clearTimeout(toRef.current)
    if (!text) return

    const start = () => {
      let i = 0
      ivRef.current = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) {
          setDone(true)
          clearInterval(ivRef.current!)
        }
      }, speed)
    }

    if (delay > 0) {
      toRef.current = setTimeout(start, delay)
    } else {
      start()
    }

    return () => {
      if (ivRef.current) clearInterval(ivRef.current)
      if (toRef.current) clearTimeout(toRef.current)
    }
  }, [text, speed, delay])

  return (
    <span className={className}>
      {displayed}
      {cursor && !done && <span className="tw-cursor">▋</span>}
    </span>
  )
}
