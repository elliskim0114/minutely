import { useState, useEffect, useRef } from 'react'

/**
 * Animates text appearing character-by-character.
 * Re-triggers whenever `text` changes.
 * @param text  The full target string
 * @param speed Milliseconds per character (default 18)
 */
export function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(false); return }
    setDisplayed('')
    setDone(false)
    let i = 0
    if (ivRef.current) clearInterval(ivRef.current)
    ivRef.current = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        setDone(true)
        clearInterval(ivRef.current!)
      }
    }, speed)
    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [text, speed])

  return { displayed, done }
}
