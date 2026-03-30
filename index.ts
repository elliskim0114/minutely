import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const PORT = 3001

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
app.use(express.json({ limit: '15mb' }))

function getClient(reqKey?: string) {
  const key = reqKey?.trim() || process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('No API key — add yours in Settings (gear icon in sidebar)')
  return new Anthropic({ apiKey: key })
}

// POST /api/perfect-day
// Body: { prompt, dayStart, dayEnd, apiKey?, userProfile?, goals?, recentEnergy? }
// Returns: PDBlock[]
app.post('/api/perfect-day', async (req, res) => {
  const { prompt, dayStart = '06:00', dayEnd = '23:00', apiKey,
    userProfile, goals, recentEnergy } = req.body as {
    prompt: string
    dayStart?: string
    dayEnd?: string
    apiKey?: string
    userProfile?: { occupation?: string; energyPattern?: string; lifestyle?: string[]; challenges?: string[]; bio?: string }
    goals?: Array<{ name: string; targetHours: number }>
    recentEnergy?: number | null
  }

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt required' })
  }

  // Build rich context section
  const contextParts: string[] = []
  if (userProfile?.occupation) contextParts.push(`Occupation: ${userProfile.occupation}`)
  if (userProfile?.energyPattern) {
    const map: Record<string, string> = { morning: 'Morning (most productive early)', afternoon: 'Afternoon', evening: 'Evening (creative peak)', night: 'Night owl (best work late)' }
    contextParts.push(`Energy pattern: ${map[userProfile.energyPattern] || userProfile.energyPattern}`)
  }
  if (userProfile?.lifestyle?.length) contextParts.push(`Daily life includes: ${userProfile.lifestyle.map((l: string) => l.replace(/-/g, ' ')).join(', ')}`)
  if (userProfile?.challenges?.length) contextParts.push(`Scheduling challenges: ${userProfile.challenges.map((c: string) => c.replace(/-/g, ' ')).join(', ')}`)
  if (goals?.length) contextParts.push(`Current goals: ${goals.map(g => `${g.name} (${g.targetHours}h/week)`).join(', ')}`)
  if (recentEnergy != null) {
    const desc = recentEnergy < 1 ? 'low' : recentEnergy < 2 ? 'moderate' : 'high'
    contextParts.push(`Recent energy level: ${desc} (${recentEnergy.toFixed(1)}/3)`)
  }
  if (userProfile?.bio) contextParts.push(`Additional context: ${userProfile.bio}`)

  const contextSection = contextParts.length > 0
    ? `\n\nUser profile:\n${contextParts.map(p => `- ${p}`).join('\n')}`
    : ''

  const system = `You are an expert personal day planner. Generate a deeply personalized daily schedule as a JSON array. Each item: {name,type,start,end}. Types: focus (deep concentrated work), routine (habits/exercise/meals), study (learning), free (breaks/admin/buffer). Times in HH:MM 24hr format. Day runs ${dayStart} to ${dayEnd}. No overlaps. 6-10 blocks. Respect the user's energy pattern — schedule deep work when they're most productive. Account for their goals and lifestyle. If they have challenges like procrastination, build in accountability blocks. Make block names specific and personal, not generic (e.g. "morning run" not just "exercise"). Return ONLY the JSON array, nothing else.${contextSection}`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: 'Create my perfect day schedule: ' + prompt }],
    })

    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('[')
    const b = txt.lastIndexOf(']')
    if (a < 0 || b <= a) throw new Error('no JSON array in response')
    const schedule = JSON.parse(txt.slice(a, b + 1))
    return res.json(schedule)
  } catch (err) {
    console.error('perfect-day error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/summary
// Body: { blocks: Block[], mode: 'day'|'week', focus?: string, apiKey?: string }
// Returns: { text: string }
app.post('/api/summary', async (req, res) => {
  const { blocks, mode, focus, apiKey } = req.body as {
    blocks: Array<{ date: string; start: string; end: string; name: string; type: string }>
    mode: 'day' | 'week'
    focus?: string
    apiKey?: string
  }

  if (!blocks?.length) {
    return res.json({ text: 'No blocks to summarise yet.' })
  }

  const blockText = blocks
    .map(b => `${b.date} ${b.start}-${b.end}: ${b.name} (${b.type})`)
    .join('\n')

  const system = `You are a thoughtful daily planner assistant for "minutely". Analyse the user's schedule and respond in structured markdown format. Use this exact structure:

## [One punchy headline about the day]

**Stats**
- [total time planned] across [N] blocks
- [X]h focus, [Y]h routine, etc.

**Highlights**
- [what's working well — 2-3 bullets]

**Watch out**
- [gaps, overlaps, or concerns — 1-2 bullets, omit section if none]

**Tip**
[One short actionable sentence]

Use ** for bold, - for bullets. Be concise and warm. Max 200 words.`

  const prompt =
    mode === 'day'
      ? `Today's focus: ${focus ?? '(none set)'}\nBlocks:\n${blockText}`
      : `Week blocks:\n${blockText}`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (msg.content[0] as { type: string; text: string }).text ?? 'Could not generate summary.'
    return res.json({ text })
  } catch (err) {
    console.error('summary error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/coach
// Body: { blocks, date, apiKey?, mode?, goals?, priorities?, energy?, focusHours? }
// Returns: { suggestions } or { review }
app.post('/api/coach', async (req, res) => {
  const { blocks, date, apiKey, mode, goals, priorities, energy, focusHours } = req.body as {
    blocks: Array<{ start: string; end: string; name: string; type: string }>
    date: string
    apiKey?: string
    mode?: 'analyze' | 'review'
    goals?: Array<{ name: string; targetAmount: number; targetUnit: string; targetPeriod: string; actualAmount: number; description?: string }>
    priorities?: string[]
    energy?: string
    focusHours?: number
  }

  if (!blocks?.length) {
    return res.json({ suggestions: [{ text: 'Add some blocks to your day first, then I can give you feedback.', icon: '●' }] })
  }

  const schedule = blocks
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(b => `${b.start}–${b.end}: ${b.name} (${b.type})`)
    .join('\n')

  const goalsText = goals?.length
    ? goals.map(g => `- ${g.name}: ${g.actualAmount}${g.targetUnit === 'minutes' ? 'min' : 'h'} / ${g.targetAmount}${g.targetUnit === 'minutes' ? 'min' : 'h'} (${g.targetPeriod})${g.description ? ` — ${g.description}` : ''}`).join('\n')
    : 'No goals set.'

  const contextText = [
    priorities?.length ? `Priorities: ${priorities.join(', ')}` : '',
    energy ? `Energy level: ${energy}` : '',
  ].filter(Boolean).join('\n')

  if (mode === 'review') {
    const system = `You are a warm, honest productivity coach. The user is reviewing their day. Write a personal, conversational day review (3–5 short paragraphs) that:
1. Acknowledges what they accomplished today based on their blocks
2. Compares their actual focus/work against their goals progress — be specific about which goals they moved forward on
3. Reflects on whether their priorities were addressed
4. Gives 1–2 kind, actionable suggestions for tomorrow
Be warm and specific. Reference actual block names and goal names. No markdown, no headers — just flowing text as if talking to them.`

    const userContent = [
      `Today (${date}) schedule:\n${schedule}`,
      `\nGoals progress:\n${goalsText}`,
      contextText ? `\n${contextText}` : '',
      focusHours != null ? `\nTotal focus time: ${focusHours}h` : '',
    ].join('')

    try {
      const client = getClient(apiKey)
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: userContent }],
      })
      const review = (msg.content[0] as { type: string; text: string }).text ?? ''
      return res.json({ review })
    } catch (err) {
      console.error('coach review error:', err)
      return res.status(500).json({ error: String(err) })
    }
  }

  // Default: analyze mode
  const system = `You are a thoughtful productivity coach for minutely, a day planner. Analyze the user's schedule and goals, then return a JSON array of 3–5 specific, actionable suggestions.

Consider: back-to-back focus blocks with no break (>90 min continuous), missing breaks, energy pacing, goal progress gaps, whether priorities are blocked in the schedule.

Return ONLY a JSON array where each item has:
{
  "text": "short suggestion (max 25 words, no markdown)",
  "icon": "one symbol: ● ◎ ◈ ◐ ✦",
  "action": { // ONLY include if you can specify exact new block details
    "type": "add_block",
    "name": "block name",
    "start": "HH:MM",
    "end": "HH:MM",
    "blockType": "routine"
  }
}

For "action": only include it when you recommend adding a SPECIFIC new block at a currently empty time. Be warm and precise.`

  const userContent = [
    `My schedule for ${date}:\n${schedule}`,
    goals?.length ? `\nMy goals:\n${goalsText}` : '',
    contextText ? `\n${contextText}` : '',
  ].join('')

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: userContent }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('[')
    const b = txt.lastIndexOf(']')
    if (a < 0 || b <= a) throw new Error('no JSON array')
    const suggestions = JSON.parse(txt.slice(a, b + 1))
    return res.json({ suggestions })
  } catch (err) {
    console.error('coach error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/fill-slots
// Body: { description, freeSlots, existingBlocks, date, dayStart, dayEnd, apiKey? }
// Returns: { blocks: [{name,start,end,type}], message: string }
app.post('/api/fill-slots', async (req, res) => {
  const { description, freeSlots, existingBlocks, date, dayStart, dayEnd, apiKey } = req.body as {
    description: string
    freeSlots: Array<{ start: string; end: string; duration: number }>
    existingBlocks: Array<{ start: string; end: string; name: string; type: string }>
    date: string
    dayStart: string
    dayEnd: string
    apiKey?: string
  }

  if (!description?.trim()) return res.status(400).json({ error: 'description required' })

  const existingText = existingBlocks.length
    ? existingBlocks.map(b => `${b.start}–${b.end}: ${b.name} (${b.type})`).join('\n')
    : 'None yet'
  const slotsText = freeSlots.length
    ? freeSlots.map(s => `${s.start}–${s.end} (${s.duration}min free)`).join('\n')
    : 'No free slots'

  const system = `You are a warm scheduling assistant for minutely. The user wants to fit specific tasks into their day.

Date: ${date}
Day hours: ${dayStart}–${dayEnd}

Existing schedule (DO NOT overlap these):
${existingText}

Free time slots available:
${slotsText}

The user wants to do: "${description}"

Parse the tasks and durations from the description. Schedule them into the free slots. Rules:
- Respect all existing blocks — no overlaps
- Use the free slots efficiently
- Match task type: meetings/calls = routine, deep work/writing/coding = focus, learning/reading = study, breaks/walks/meals = free
- If a task doesn't fit exactly, round to nearest 15 minutes
- Only schedule tasks that fit within the available free slots

Return a JSON object:
{
  "blocks": [{"name": "task name", "start": "HH:MM", "end": "HH:MM", "type": "focus|routine|study|free"}],
  "message": "a warm 1-2 sentence summary of what was scheduled and any notes, e.g. 'I've fit your study session and run into the afternoon gaps — your busiest window is 2–4pm.'"
}

Return ONLY the JSON object.`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: description }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('{')
    const b = txt.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('no JSON in response')
    const result = JSON.parse(txt.slice(a, b + 1))
    return res.json(result)
  } catch (err) {
    console.error('fill-slots error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/build-day
// Body: { date, dayStart, dayEnd, energy, priorities, goals, existingBlocks, freeSlots, extraContext?, apiKey? }
// Returns: [{ name, start, end, type }] — new blocks to add around existing ones
app.post('/api/build-day', async (req, res) => {
  const { date, dayStart, dayEnd, energy, priorities, goals, existingBlocks, freeSlots, extraContext, apiKey } = req.body as {
    date: string
    dayStart: string
    dayEnd: string
    energy?: number
    priorities?: string[]
    goals?: Array<{ name: string; targetHours?: number; actualHours?: number }>
    existingBlocks?: Array<{ start: string; end: string; name: string; type: string }>
    freeSlots?: Array<{ start: string; end: string; duration: number }>
    extraContext?: string
    apiKey?: string
  }

  const energyLabels = ['', 'low', 'medium', 'high']
  const energyTxt = energy ? energyLabels[energy] || 'medium' : 'medium'
  const prioritiesTxt = priorities?.filter(Boolean).join(', ') || 'none specified'
  const goalsTxt = goals?.length
    ? goals.map(g => `- ${g.name}${g.targetHours ? ` (target: ${g.targetHours}h, done: ${g.actualHours ?? 0}h)` : ''}`).join('\n')
    : 'none set'
  const existingTxt = existingBlocks?.length
    ? existingBlocks.map(b => `${b.start}–${b.end}: ${b.name} (${b.type})`).join('\n')
    : 'none yet'
  const slotsTxt = freeSlots?.length
    ? freeSlots.map(s => `${s.start}–${s.end} (${s.duration}min)`).join('\n')
    : 'all day is free'

  const system = `You are a smart day-design assistant for minutely. Build a focused, realistic day schedule that fits around the user's existing blocks.

Rules:
- Only schedule into the FREE SLOTS listed — never overlap existing blocks
- Energy: ${energyTxt} — ${energyTxt === 'low' ? 'keep it light, avoid back-to-back focus' : energyTxt === 'high' ? 'this is peak time, front-load deep work' : 'mix focus and lighter tasks'}
- Priorities must appear as blocks in the schedule
- Respect goal context — include time blocks that advance under-tracked goals
- Match type: deep work/writing/coding = focus, meetings/errands = routine, learning/reading = study, breaks/meals/walks = free
- Add 1–2 short break blocks (15–30min) for breathing room
- Each block: minimum 20min, maximum 120min. Round all times to nearest 15min.
- Return 4–8 new blocks total (not counting existing ones)

Day: ${date}, ${dayStart}–${dayEnd}
Priorities: ${prioritiesTxt}
Goals: ${goalsTxt}
Existing: ${existingTxt}
Free slots: ${slotsTxt}${extraContext ? `\nExtra context: ${extraContext}` : ''}

Return ONLY a JSON array of new blocks:
[{"name": "block name", "start": "HH:MM", "end": "HH:MM", "type": "focus|routine|study|free"}]`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: 'Design my day.' }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('[')
    const b = txt.lastIndexOf(']')
    if (a < 0 || b <= a) throw new Error('no JSON array in response')
    const blocks = JSON.parse(txt.slice(a, b + 1))
    return res.json(blocks)
  } catch (err) {
    console.error('build-day error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/capture
// Body: { text: string, today: string, apiKey?: string }
// Returns: ParsedBlock[]
app.post('/api/capture', async (req, res) => {
  const { text, today, apiKey } = req.body as {
    text: string
    today: string
    apiKey?: string
  }

  if (!text?.trim()) return res.status(400).json({ error: 'text required' })

  const system = `You are a scheduling assistant for minutely. Extract all events, meetings, tasks, and deadlines from the text provided. Today is ${today}.

For each item found return a JSON object:
{
  "name": "clear event/task name",
  "date": "YYYY-MM-DD",
  "start": "HH:MM",
  "end": "HH:MM",
  "type": "focus|routine|study|free",
  "confidence": "high|medium|low"
}

Rules:
- Resolve relative dates: "tomorrow" → actual YYYY-MM-DD, "next Monday" → actual date, etc.
- If no time given: set start and end to null
- Estimate end time from duration clues ("30 min meeting" → start + 30m, "~2h task" → start + 2h). If no end and no duration, estimate 1h.
- type: meetings/calls/appointments = routine; deep work/writing/coding = focus; learning/reading = study; lunch/breaks/walks = free
- confidence: high = explicit time given, medium = date given but time estimated, low = no date/time
- Only include real events, not vague mentions
Return ONLY a JSON array, nothing else.`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: text }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('[')
    const b = txt.lastIndexOf(']')
    if (a < 0 || b <= a) throw new Error('no JSON array in response')
    const events = JSON.parse(txt.slice(a, b + 1))
    return res.json(events)
  } catch (err) {
    console.error('capture error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/capture-image
// Body: { image: string (base64), mimeType: string, today: string, apiKey?: string }
// Returns: ParsedBlock[]
app.post('/api/capture-image', async (req, res) => {
  const { image, mimeType, today, apiKey } = req.body as {
    image: string
    mimeType: string
    today: string
    apiKey?: string
  }

  if (!image) return res.status(400).json({ error: 'image required' })

  const system = `You are a scheduling assistant for minutely. Extract all events, meetings, tasks, and deadlines from the image provided. Today is ${today}.

For each item found return a JSON object:
{
  "name": "clear event/task name",
  "date": "YYYY-MM-DD",
  "start": "HH:MM",
  "end": "HH:MM",
  "type": "focus|routine|study|free",
  "confidence": "high|medium|low"
}

Rules:
- Resolve relative dates: "tomorrow" → actual YYYY-MM-DD, "next Monday" → actual date, etc.
- If no time given: set start and end to null
- Estimate end time from duration clues. If no end and no duration, estimate 1h.
- type: meetings/calls/appointments = routine; deep work/writing/coding = focus; learning/reading = study; lunch/breaks/walks = free
- confidence: high = explicit time given, medium = date given but time estimated, low = no date/time
- Only include real events, not decorative text or UI elements
Return ONLY a JSON array, nothing else.`

  // Validate + normalize MIME type
  const VALID_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const safeMime = VALID_MIMES.includes(mimeType) ? mimeType : 'image/jpeg'

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: safeMime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: image,
            },
          },
          {
            type: 'text',
            text: 'Extract all events, appointments, and tasks from this image.',
          },
        ],
      }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''

    // Strip markdown code fences if AI wrapped the response
    let jsonStr = txt.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }

    // Find the JSON array (first [ to last ])
    const a = jsonStr.indexOf('[')
    const b = jsonStr.lastIndexOf(']')
    if (a < 0 || b <= a) {
      console.error('capture-image: no JSON array found in:', jsonStr.slice(0, 200))
      throw new Error('AI did not return valid JSON — try the text tab instead')
    }
    const events = JSON.parse(jsonStr.slice(a, b + 1))
    return res.json(events)
  } catch (err) {
    console.error('capture-image error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/build-day
// Body: { date, dayStart, dayEnd, energy, priorities, existingBlocks, freeSlots, apiKey? }
// Returns: Block[]
app.post('/api/build-day', async (req, res) => {
  const { date, dayStart, dayEnd, energy, priorities, existingBlocks, freeSlots, apiKey } = req.body as {
    date: string
    dayStart: string
    dayEnd: string
    energy: number
    priorities: string[]
    existingBlocks: Array<{ start: string; end: string; name: string; type: string }>
    freeSlots: Array<{ start: string; end: string; duration: number }>
    apiKey?: string
  }

  const energyLabel = ['unset', 'low', 'medium', 'peak'][energy] || 'medium'
  const prioText = priorities.filter(Boolean).length
    ? `Top priorities: ${priorities.filter(Boolean).map((p, i) => `${i + 1}. ${p}`).join(', ')}`
    : 'No priorities set'
  const existingText = existingBlocks.length
    ? existingBlocks.map(b => `${b.start}–${b.end}: ${b.name} (${b.type})`).join('\n')
    : 'None yet'
  const slotsText = freeSlots.map(s => `${s.start}–${s.end} (${s.duration}m free)`).join('\n')

  const system = `You are a smart day-builder for minutely. Given the user's energy, priorities, and free time slots, create focused work blocks that fit perfectly into their day.

Energy level: ${energyLabel}
${prioText}
Existing schedule:
${existingText}

Free slots available:
${slotsText}

Day runs ${dayStart}–${dayEnd} on ${date}.

Create 3–7 blocks that:
- Use the free slots efficiently (don't overlap existing blocks)
- Match the energy level (peak energy = deep focus work, low = light tasks)
- Address the top priorities if set
- IMPORTANT: Insert a 10-15 min break after any focus stretch longer than 90 minutes
- Never schedule more than 3 consecutive focus blocks without a break in between
- Add an "end of day wind-down" routine block in the last 30 minutes of the day
- Have realistic names and appropriate types (focus/routine/study/free)
- Include a brief "reasoning" field explaining why each block was placed where it is

Return ONLY a JSON array: [{name, start, end, type}]`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: `Build my day for ${date}` }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('[')
    const b = txt.lastIndexOf(']')
    if (a < 0 || b <= a) throw new Error('no JSON array in response')
    const blocks = JSON.parse(txt.slice(a, b + 1))
    return res.json(blocks)
  } catch (err) {
    console.error('build-day error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/reschedule
// Body: { date, currentTime, blocks, apiKey? }
// Returns: { blocks: [{name,start,end,type}], reasoning: string }
app.post('/api/reschedule', async (req, res) => {
  const { date, currentTime, blocks, apiKey } = req.body as {
    date: string
    currentTime: string
    blocks: Array<{ name: string; start: string; end: string; type: string }>
    apiKey?: string
  }

  if (!blocks?.length) return res.status(400).json({ error: 'blocks required' })

  const blockText = blocks
    .map(b => `${b.start}–${b.end}: ${b.name} (${b.type})`)
    .join('\n')

  const system = `You are a warm, practical schedule assistant for minutely. The user is running late and needs their remaining schedule reshuffled.

Current time: ${currentTime}
Date: ${date}

Remaining blocks to reschedule:
${blockText}

Reschedule these blocks starting from ${currentTime} with realistic 5-minute gaps between them. Keep the same order where possible. Keep durations similar to the originals. Don't push anything past midnight.

Return a JSON object with two fields:
{
  "blocks": [{name, start, end, type}],
  "reasoning": "a warm, 1-2 sentence explanation of what you changed and why, e.g. 'I shifted your deep work to 3pm since your meeting ran long — you'll still have a solid 90-minute focus window before dinner.'"
}

Return ONLY the JSON object.`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: `Reschedule my remaining blocks from ${currentTime}` }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('{')
    const b = txt.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('no JSON in response')
    const result = JSON.parse(txt.slice(a, b + 1))
    return res.json(result)
  } catch (err) {
    console.error('reschedule error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/breakdown
// Body: { goal, totalHours?, deadline?, date, dayStart, dayEnd, existingWeekBlocks, apiKey? }
// Returns: { blocks: [{name,start,end,date,type,note}], plan: string }
app.post('/api/breakdown', async (req, res) => {
  const { goal, totalHours, deadline, date, dayStart, dayEnd, existingWeekBlocks, apiKey } = req.body as {
    goal: string
    totalHours?: number
    deadline?: string
    date: string
    dayStart: string
    dayEnd: string
    existingWeekBlocks: Array<{ date: string; start: string; end: string; name: string; type: string }>
    apiKey?: string
  }

  if (!goal?.trim()) return res.status(400).json({ error: 'goal required' })

  const existingText = existingWeekBlocks.length
    ? existingWeekBlocks.map(b => `${b.date} ${b.start}–${b.end}: ${b.name}`).join('\n')
    : 'None yet'

  const system = `You are a warm planning assistant for minutely. Break down a goal into specific focused work sessions spread across the week.

Goal: "${goal}"
${totalHours ? `Total estimated hours: ${totalHours}h` : ''}
${deadline ? `Deadline: ${deadline}` : ''}
Starting from: ${date}
Day hours: ${dayStart}–${dayEnd}

Existing blocks this week (avoid conflicts):
${existingText}

Break this goal into 3–6 specific, well-named work sessions. Each session should have a concrete, specific name — NOT generic like "work on ${goal}" but specific like "outline and research – ch3", "write first draft sections 1-2", etc.

Spread sessions across the next few days. Keep each session 60-120 minutes. Find open time slots that don't conflict with existing blocks.

Return a JSON object:
{
  "blocks": [{"name": "specific session name", "start": "HH:MM", "end": "HH:MM", "date": "YYYY-MM-DD", "type": "focus", "note": "brief note on what to accomplish"}],
  "plan": "a warm 2-3 sentence overview of the plan, e.g. 'I've spread your thesis work across the next 4 days, front-loading the harder research early in the week when energy is highest. Each session has a specific focus so you always know exactly what to work on.'"
}

Return ONLY the JSON object.`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: `Break down: ${goal}` }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('{')
    const b = txt.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('no JSON in response')
    const result = JSON.parse(txt.slice(a, b + 1))
    return res.json(result)
  } catch (err) {
    console.error('breakdown error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/weekly-plan
// Body: { weekDates, existingBlocks, lastWeekBlocks, priorities, energy, apiKey? }
// Returns: { reflection: string, plan: [{date,name,start,end,type,reason}], summary: string }
app.post('/api/weekly-plan', async (req, res) => {
  const { weekDates, existingBlocks, lastWeekBlocks, priorities, energy, apiKey } = req.body as {
    weekDates: string[]
    existingBlocks: Array<{ date: string; start: string; end: string; name: string; type: string }>
    lastWeekBlocks: Array<{ date: string; start: string; end: string; name: string; type: string }>
    priorities: string[]
    energy: string
    apiKey?: string
  }

  const weekStr = weekDates.join(', ')
  const lastWeekText = lastWeekBlocks.length
    ? lastWeekBlocks.map(b => `${b.date} ${b.start}–${b.end}: ${b.name} (${b.type})`).join('\n')
    : 'No data from last week'
  const existingText = existingBlocks.length
    ? existingBlocks.map(b => `${b.date} ${b.start}–${b.end}: ${b.name} (${b.type})`).join('\n')
    : 'None yet'
  const prioText = priorities.filter(Boolean).join(', ') || 'None set'

  const system = `You are a warm weekly planning coach for minutely.

Week dates: ${weekStr}
Energy level: ${energy}
This week's priorities: ${prioText}

Last week's schedule:
${lastWeekText}

Existing blocks this week:
${existingText}

Create a thoughtful week plan that:
- Front-loads important focus work early in the week (Mon/Tue)
- Includes recovery/wind-down blocks
- Respects energy level (high energy = more focus blocks, low = lighter tasks)
- Addresses the stated priorities
- Doesn't conflict with existing blocks
- Each block has a specific, meaningful name

Return a JSON object:
{
  "reflection": "a warm 2-sentence reflection on last week's pattern (what went well, what to improve)",
  "plan": [{"date": "YYYY-MM-DD", "name": "block name", "start": "HH:MM", "end": "HH:MM", "type": "focus|routine|study|free", "reason": "one sentence why this block is here"}],
  "summary": "a warm 2-sentence overview of the week plan"
}

Return ONLY the JSON object.`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: `Plan my week: ${weekStr}` }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('{')
    const b = txt.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('no JSON in response')
    const result = JSON.parse(txt.slice(a, b + 1))
    return res.json(result)
  } catch (err) {
    console.error('weekly-plan error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/habits
// Body: { blocks (last 14 days), apiKey? }
// Returns: { habits: [{pattern, suggestion, confidence, type}] }
app.post('/api/habits', async (req, res) => {
  const { blocks, apiKey } = req.body as {
    blocks: Array<{ date: string; start: string; end: string; name: string; type: string }>
    apiKey?: string
  }

  if (!blocks?.length) return res.json({ habits: [] })

  const blockText = blocks
    .map(b => `${b.date} ${b.start}–${b.end}: ${b.name} (${b.type})`)
    .join('\n')

  const system = `You are a warm habit-detection assistant for minutely. Analyze the user's schedule from the past 14 days and find patterns.

Schedule data:
${blockText}

Look for:
- Blocks with the same or similar names appearing 3+ times
- Blocks appearing in similar time slots (within 60 minutes of each other)
- Weekly patterns (e.g., every Monday morning)

Return 2–4 habits as a JSON array:
[{
  "pattern": "what you observed, e.g. 'morning runs 4 times this week between 6-7am'",
  "suggestion": "warm suggestion, e.g. 'Should I add a morning run to your perfect day blueprint? You've been consistent!'",
  "confidence": "high|medium",
  "type": "the block type (focus/routine/study/free)"
}]

Return ONLY the JSON array. If no clear patterns exist, return [].`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: 'Analyze my schedule for habit patterns' }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('[')
    const b = txt.lastIndexOf(']')
    if (a < 0 || b <= a) return res.json({ habits: [] })
    const habits = JSON.parse(txt.slice(a, b + 1))
    return res.json({ habits })
  } catch (err) {
    console.error('habits error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/rightnow
// Body: { currentTime, date, blocks, priorities, energy, focus, apiKey? }
// Returns: { action: string, reason: string, blockSuggestion?: {name,start,end,type} }
app.post('/api/rightnow', async (req, res) => {
  const { currentTime, date, blocks, priorities, energy, focus, apiKey } = req.body as {
    currentTime: string
    date: string
    blocks: Array<{ start: string; end: string; name: string; type: string }>
    priorities: string[]
    energy: string
    focus: string
    apiKey?: string
  }

  const blockText = blocks.length
    ? blocks.map(b => `${b.start}–${b.end}: ${b.name} (${b.type})`).join('\n')
    : 'No blocks scheduled'
  const prioText = priorities.filter(Boolean).join(', ') || 'none'

  const system = `You are a warm, direct productivity assistant for minutely. The user wants to know exactly what to do RIGHT NOW.

Current time: ${currentTime} on ${date}
Energy level: ${energy}
Today's focus: ${focus || 'not set'}
Top priorities: ${prioText}

Today's schedule:
${blockText}

Give ONE clear, specific recommendation for what to do right now. Be warm but direct.

Return a JSON object:
{
  "action": "one specific sentence, e.g. 'Start your deep work session now — you've got 90 uninterrupted minutes before your next commitment.'",
  "reason": "one sentence of context, e.g. 'Your energy is peak right now and you have no meetings until 2pm.'",
  "blockSuggestion": {"name": "suggested block name", "start": "${currentTime}", "end": "HH:MM", "type": "focus"} // optional, only if no relevant block exists in the next 30 mins
}

Return ONLY the JSON object.`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: `What should I do right now at ${currentTime}?` }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('{')
    const b = txt.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('no JSON in response')
    const result = JSON.parse(txt.slice(a, b + 1))
    return res.json(result)
  } catch (err) {
    console.error('rightnow error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/manage
// Body: { blocks, instruction, date, dayStart, dayEnd, apiKey? }
// Returns: { blocks: [{id,name,start,end,date,type}], summary: string }
app.post('/api/manage', async (req, res) => {
  const { blocks, instruction, date, dayStart, dayEnd, apiKey } = req.body as {
    blocks: Array<{ id: number; name: string; start: string; end: string; date: string; type: string }>
    instruction: string
    date: string
    dayStart: string
    dayEnd: string
    apiKey?: string
  }

  if (!blocks?.length) return res.status(400).json({ error: 'blocks required' })
  if (!instruction?.trim()) return res.status(400).json({ error: 'instruction required' })

  const blockText = blocks
    .map(b => `[id:${b.id}] ${b.date} ${b.start}–${b.end}: ${b.name} (${b.type})`)
    .join('\n')

  const system = `You are a schedule editor for minutely. The user wants to make changes to their calendar blocks.

Today: ${date}
Day hours: ${dayStart}–${dayEnd}

Current blocks:
${blockText}

The user says: "${instruction}"

Understand their intent and return the COMPLETE modified block list. Rules:
- Keep each block's id unchanged
- You may change: name, start, end, date, type
- Times in HH:MM 24hr. Dates in YYYY-MM-DD.
- CRITICAL: No two blocks on the same day may overlap — not even by 1 minute. If adding or moving a block causes a conflict, cascade-shift the affected blocks forward in time to make room. Shorten blocks only as a last resort if they would exceed dayEnd.
- If the user asks to ADD a new block: insert it at the requested time, then push any conflicting blocks forward so everything still fits. Generate a new unique id > 100000 for the new block.
- If swapping two blocks, swap their start/end times (keep their dates)
- If moving something "to tomorrow" use the date after ${date}
- If compressing, remove gaps of ≥15 min between consecutive blocks on the same day
- Be practical — if a block would go past dayEnd, shorten it slightly

Return a JSON object:
{
  "blocks": [{"id": number, "name": "...", "start": "HH:MM", "end": "HH:MM", "date": "YYYY-MM-DD", "type": "..."}],
  "summary": "one warm sentence explaining what you changed"
}

Return ONLY the JSON object.`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: instruction }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('{')
    const b = txt.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('no JSON in response')
    const result = JSON.parse(txt.slice(a, b + 1))
    return res.json(result)
  } catch (err) {
    console.error('manage error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

// POST /api/analytics-insights
// Body: { analytics: object, goals: object[], apiKey?: string }
// Returns: { insights: Array<{ icon, title, body, prompt? }> }
app.post('/api/analytics-insights', async (req, res) => {
  const { analytics, goals = [], apiKey } = req.body as {
    analytics: {
      focusHoursPerDay: { label: string; date: string; hours: number }[]
      typeBreakdown: Record<string, number>
      healthScores: { label: string; score: number; grade: string }[]
      avgHealth: number
      currentStreak: number
      topMoved: [string, number][]
      weekFocusH: number
      energy: { date: string; level: number }[]
    }
    goals: Array<{ name: string; targetHours: number; actualHours: number; pct: number }>
    apiKey?: string
  }

  const focusSummary = analytics.focusHoursPerDay
    .map(d => `${d.label}: ${d.hours}h focus`)
    .join(', ')

  const typeSummary = Object.entries(analytics.typeBreakdown)
    .map(([t, m]) => `${t}: ${Math.round(m / 60 * 10) / 10}h`)
    .join(', ')

  const healthSummary = analytics.healthScores
    .map(d => `${d.label}: ${d.grade}`)
    .join(', ')

  const goalsSummary = goals.length
    ? goals.map(g => `${g.name}: ${g.actualHours}h / ${g.targetHours}h target (${g.pct}%)`).join(', ')
    : 'no goals set'

  const movedSummary = analytics.topMoved.length
    ? analytics.topMoved.map(([n, c]) => `"${n}" moved ${c}x`).join(', ')
    : 'none'

  const system = `You are a thoughtful scheduling coach for "minutely", a time-blocking productivity app. Analyze the user's weekly scheduling data and provide 4-5 sharp, specific, actionable insights. Each insight must be directly grounded in their actual numbers.

Return a JSON object:
{
  "insights": [
    {
      "icon": "emoji",
      "title": "short punchy title (5-7 words)",
      "body": "2-3 sentences grounded in their specific data. Reference actual numbers. End with one concrete recommendation.",
      "prompt": "a ready-to-use prompt the user can send to the AI day builder (e.g. 'Schedule 2h of deep focus every morning Mon-Fri')"
    }
  ]
}

Guidelines:
- Be direct and specific. Say "your Mon/Tue sessions at 2.5h are your sweet spot" not "some days are better"
- Mix types: scheduling pattern, energy alignment, goal gap, balance observation, something to try this week
- The "prompt" field should be an actionable scheduling instruction the user can one-click apply
- Return ONLY the JSON object, no markdown`

  const userMsg = `My weekly data:
Focus by day: ${focusSummary}
Total focus this week: ${analytics.weekFocusH}h
Time by type: ${typeSummary}
Plan health: ${healthSummary} (avg: grade ${analytics.avgHealth >= 90 ? 'A' : analytics.avgHealth >= 75 ? 'B' : analytics.avgHealth >= 60 ? 'C' : analytics.avgHealth >= 45 ? 'D' : 'F'})
Focus streak: ${analytics.currentStreak} days
Most rescheduled: ${movedSummary}
Goals: ${goalsSummary}`

  try {
    const client = getClient(apiKey)
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    const txt = (msg.content[0] as { type: string; text: string }).text ?? ''
    const a = txt.indexOf('{')
    const b = txt.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('no JSON in response')
    const result = JSON.parse(txt.slice(a, b + 1))
    return res.json(result)
  } catch (err) {
    console.error('analytics-insights error:', err)
    return res.status(500).json({ error: String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`minutely server running on http://localhost:${PORT}`)
})
