import { useEffect, useState } from 'react'
import { useStore } from '../store'

// SVG animals as inline components
function Unicorn() {
  return (
    <svg width="80" height="64" viewBox="0 0 80 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="38" cy="42" rx="22" ry="14" fill="#F9E0FF" stroke="#D88EFF" strokeWidth="1.5"/>
      {/* Neck */}
      <path d="M46 32 C48 26 52 22 50 18 C48 14 44 16 44 20 L42 30 Z" fill="#F9E0FF" stroke="#D88EFF" strokeWidth="1.5"/>
      {/* Head */}
      <ellipse cx="50" cy="17" rx="8" ry="6.5" fill="#F9E0FF" stroke="#D88EFF" strokeWidth="1.5"/>
      {/* Horn */}
      <path d="M53 11 L56 2 L49 9 Z" fill="#FFD700" stroke="#FFA500" strokeWidth="1"/>
      {/* Eye */}
      <circle cx="53" cy="16" r="1.8" fill="#7B2D8B"/>
      <circle cx="53.5" cy="15.5" r="0.6" fill="white"/>
      {/* Ear */}
      <path d="M46 13 L44 8 L48 12 Z" fill="#FFB6E8" stroke="#D88EFF" strokeWidth="1"/>
      {/* Mane */}
      <path d="M46 20 C44 18 40 16 38 14 C40 16 42 18 44 22" fill="#FF80D5" opacity=".8"/>
      <path d="M45 24 C42 22 38 20 36 18" stroke="#FF80D5" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M44 28 C41 26 37 24 35 22" stroke="#CC44CC" strokeWidth="2" strokeLinecap="round"/>
      {/* Tail */}
      <path d="M16 38 C10 32 8 28 12 24 C14 28 16 32 14 38" fill="#FF80D5" stroke="#D88EFF" strokeWidth="1"/>
      <path d="M16 38 C6 36 4 32 8 28" stroke="#CC44CC" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Legs - front */}
      <rect x="44" y="52" width="5" height="12" rx="2.5" fill="#F9E0FF" stroke="#D88EFF" strokeWidth="1.2"/>
      <rect x="50" y="52" width="5" height="12" rx="2.5" fill="#F9E0FF" stroke="#D88EFF" strokeWidth="1.2"/>
      {/* Legs - back */}
      <rect x="24" y="52" width="5" height="12" rx="2.5" fill="#F9E0FF" stroke="#D88EFF" strokeWidth="1.2"/>
      <rect x="30" y="52" width="5" height="12" rx="2.5" fill="#F9E0FF" stroke="#D88EFF" strokeWidth="1.2"/>
      {/* Sparkles */}
      <text x="2" y="22" fontSize="10">✨</text>
      <text x="62" y="30" fontSize="8">⭐</text>
      <text x="68" y="18" fontSize="6">✦</text>
    </svg>
  )
}

function Fox() {
  return (
    <svg width="72" height="60" viewBox="0 0 72 60" fill="none">
      {/* Body */}
      <ellipse cx="34" cy="40" rx="20" ry="13" fill="#E8661A" stroke="#C04A00" strokeWidth="1.5"/>
      {/* White belly */}
      <ellipse cx="34" cy="43" rx="11" ry="7" fill="#FFF0E0"/>
      {/* Neck + Head */}
      <path d="M42 30 C44 24 48 20 46 16 L38 18 L38 28 Z" fill="#E8661A" stroke="#C04A00" strokeWidth="1.5"/>
      <ellipse cx="44" cy="15" rx="9" ry="7" fill="#E8661A" stroke="#C04A00" strokeWidth="1.5"/>
      {/* Ears */}
      <path d="M39 9 L36 2 L43 8 Z" fill="#E8661A" stroke="#C04A00" strokeWidth="1"/>
      <path d="M39 9 L37 4 L42 8 Z" fill="#FFB080"/>
      <path d="M49 8 L50 1 L55 7 Z" fill="#E8661A" stroke="#C04A00" strokeWidth="1"/>
      <path d="M50 8 L51 3 L54 7 Z" fill="#FFB080"/>
      {/* Face */}
      <ellipse cx="44" cy="18" rx="6" ry="4" fill="#FFF0E0"/>
      {/* Eyes */}
      <ellipse cx="41" cy="14" rx="2" ry="2.2" fill="#1A1A1A"/>
      <circle cx="41.7" cy="13.4" r=".8" fill="white"/>
      <ellipse cx="48" cy="14" rx="2" ry="2.2" fill="#1A1A1A"/>
      <circle cx="48.7" cy="13.4" r=".8" fill="white"/>
      {/* Nose */}
      <ellipse cx="44.5" cy="18" rx="2" ry="1.3" fill="#2A1010"/>
      {/* Tail */}
      <path d="M14 38 C4 30 0 22 6 16 C8 22 10 30 12 38" fill="#E8661A" stroke="#C04A00" strokeWidth="1.5"/>
      <path d="M14 38 C6 36 2 28 6 20" fill="#FFF0E0" stroke="#E8661A" strokeWidth="1"/>
      {/* White tail tip */}
      <ellipse cx="6" cy="17" rx="4" ry="3" fill="white" stroke="#E8661A" strokeWidth="1"/>
      {/* Legs */}
      <rect x="40" y="50" width="5" height="10" rx="2.5" fill="#E8661A" stroke="#C04A00" strokeWidth="1"/>
      <rect x="46" y="50" width="5" height="10" rx="2.5" fill="#E8661A" stroke="#C04A00" strokeWidth="1"/>
      <rect x="21" y="50" width="5" height="10" rx="2.5" fill="#E8661A" stroke="#C04A00" strokeWidth="1"/>
      <rect x="27" y="50" width="5" height="10" rx="2.5" fill="#E8661A" stroke="#C04A00" strokeWidth="1"/>
    </svg>
  )
}

function Dragon() {
  return (
    <svg width="90" height="68" viewBox="0 0 90 68" fill="none">
      {/* Wings */}
      <path d="M50 28 C58 18 72 16 76 24 C72 22 62 26 58 34 Z" fill="#7C3AED" opacity=".7"/>
      <path d="M30 28 C22 18 8 16 4 24 C8 22 18 26 22 34 Z" fill="#7C3AED" opacity=".7"/>
      {/* Body */}
      <ellipse cx="40" cy="44" rx="24" ry="16" fill="#6D28D9"/>
      {/* Belly scales */}
      <ellipse cx="40" cy="47" rx="14" ry="9" fill="#A78BFA" opacity=".6"/>
      {/* Neck */}
      <path d="M48 32 C50 24 54 20 52 14 C50 10 44 12 44 18 L42 30 Z" fill="#6D28D9"/>
      {/* Head */}
      <ellipse cx="52" cy="13" rx="10" ry="8" fill="#6D28D9"/>
      {/* Snout */}
      <ellipse cx="58" cy="16" rx="6" ry="4" fill="#7C3AED"/>
      {/* Nostrils */}
      <ellipse cx="56" cy="17" rx="1.2" ry=".8" fill="#4C1D95"/>
      <ellipse cx="60" cy="17" rx="1.2" ry=".8" fill="#4C1D95"/>
      {/* Eyes */}
      <ellipse cx="50" cy="10" rx="3" ry="3.2" fill="#FCD34D"/>
      <ellipse cx="50" cy="10" rx="1.2" ry="2.4" fill="#1A0A00"/>
      {/* Horns */}
      <path d="M47 6 L44 0 L49 5 Z" fill="#C4B5FD"/>
      <path d="M55 5 L55 -1 L59 4 Z" fill="#C4B5FD"/>
      {/* Tail */}
      <path d="M16 48 C8 44 4 36 8 28 C10 34 14 42 12 48" fill="#6D28D9"/>
      <path d="M12 48 L4 52 L10 44 Z" fill="#7C3AED"/>
      {/* Legs */}
      <path d="M52 56 L56 66 M54 56 L50 66" stroke="#6D28D9" strokeWidth="5" strokeLinecap="round"/>
      <path d="M28 56 L24 66 M30 56 L34 66" stroke="#6D28D9" strokeWidth="5" strokeLinecap="round"/>
      {/* Claws */}
      <path d="M50 65 L48 68 M54 66 L53 68 M58 65 L60 68" stroke="#C4B5FD" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Fire breath */}
      <text x="62" y="22" fontSize="16">🔥</text>
      <text x="72" y="16" fontSize="10">✦</text>
    </svg>
  )
}

function Rocket() {
  return (
    <svg width="50" height="80" viewBox="0 0 50 80" fill="none">
      {/* Body */}
      <path d="M25 5 C18 5 12 15 12 30 L12 55 L38 55 L38 30 C38 15 32 5 25 5 Z" fill="#E8EAFF" stroke="#6366F1" strokeWidth="1.5"/>
      {/* Window */}
      <circle cx="25" cy="30" r="7" fill="#818CF8" stroke="#6366F1" strokeWidth="1.5"/>
      <circle cx="25" cy="30" r="4" fill="#C7D2FE" opacity=".7"/>
      {/* Fins */}
      <path d="M12 48 L2 60 L12 55 Z" fill="#F43F5E" stroke="#BE123C" strokeWidth="1"/>
      <path d="M38 48 L48 60 L38 55 Z" fill="#F43F5E" stroke="#BE123C" strokeWidth="1"/>
      {/* Nose cone */}
      <path d="M25 5 C22 2 20 0 25 0 C30 0 28 2 25 5 Z" fill="#F43F5E"/>
      {/* Flames */}
      <path d="M17 55 C17 60 14 68 17 72 C20 68 18 62 20 58" fill="#FCD34D" opacity=".9"/>
      <path d="M25 55 C25 62 22 70 25 76 C28 70 25 62 25 55" fill="#FB923C" opacity=".9"/>
      <path d="M33 55 C33 60 36 68 33 72 C30 68 32 62 30 58" fill="#FCD34D" opacity=".9"/>
      <path d="M25 55 C25 62 23 72 25 76 C27 72 25 62 25 55" fill="#FFF7ED"/>
      {/* Stars */}
      <text x="-12" y="20" fontSize="10">⭐</text>
      <text x="42" y="28" fontSize="8">✦</text>
    </svg>
  )
}

const ANIMALS: Record<string, { component: React.ReactNode; label: string; speed: number; y: number }> = {
  unicorn: { component: <Unicorn />, label: '🦄', speed: 3.5, y: 0 },
  fox:     { component: <Fox />,     label: '🦊', speed: 4.2, y: 4 },
  dragon:  { component: <Dragon />,  label: '🐉', speed: 5.0, y: -8 },
  rocket:  { component: <Rocket />,  label: '🚀', speed: 6.5, y: -20 },
}

export default function CelebrationAnimal() {
  const { celebrationAnimal, clearCelebration } = useStore()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (celebrationAnimal) {
      setVisible(true)
      const t = setTimeout(() => {
        setVisible(false)
        clearCelebration()
      }, 4800)
      return () => clearTimeout(t)
    }
  }, [celebrationAnimal])

  if (!celebrationAnimal || !visible) return null

  const animal = ANIMALS[celebrationAnimal]
  if (!animal) return null

  const isRocket = celebrationAnimal === 'rocket'

  return (
    <div
      className={`celebration-animal celebration-${celebrationAnimal}`}
      style={{
        animationDuration: `${animal.speed}s`,
        bottom: isRocket ? 'auto' : `${68 + animal.y}px`,
        top: isRocket ? '40px' : 'auto',
      }}
      onClick={clearCelebration}
      title="click to dismiss"
    >
      {animal.component}
    </div>
  )
}
