import { describe, expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]

import { firstStrong, layout, toIsolated, toVisual, RLI, PDI } from '../hooks/bidi'

describe('bidi', () => {
  test('a Hebrew line is right-to-left, its characters reversed for the terminal', async () => {
    expect(firstStrong('שלום עולם')).toBe('rtl')
    expect(toVisual('שלום עולם', 'rtl')).toBe('םלוע םולש')
  })

  test('English and numbers inside Hebrew keep their own order', async () => {
    expect(toVisual('קובץ index.js נשבר', 'rtl')).toBe('רבשנ index.js ץבוק')
    expect(toVisual('יש 120 דירות', 'rtl')).toBe('תוריד 120 שי')
    expect(toVisual('בשעה 12:30', 'rtl')).toBe('12:30 העשב')
  })

  test('inline code stays left-to-right and is not mirrored', async () => {
    expect(toVisual('תריץ `npm test (a)` עכשיו', 'rtl')).toBe('וישכע `npm test (a)` ץירת')
  })

  test('brackets around Hebrew are mirrored', async () => {
    expect(toVisual('(שלום)', 'rtl')).toBe('(םולש)')
  })

  test('an English line with a Hebrew word stays left-to-right', async () => {
    expect(firstStrong('fix the שלום bug')).toBe('ltr')
    expect(toVisual('fix the שלום bug', 'ltr')).toBe('fix the םולש bug')
  })

  test('fenced code is left-to-right and untouched', async () => {
    const rows = layout('תקן את זה:\n```\nconst x = 1 // הערה\n```', { width: 80, reorder: true })
    expect(rows.map(r => r.dir)).toEqual(['rtl', 'ltr', 'ltr', 'ltr'])
    expect(rows[2]?.text).toBe('const x = 1 // הערה')
  })

  test('long lines wrap in reading order before reordering', async () => {
    const rows = layout('אחת שתיים שלוש ארבע', { width: 10, reorder: false })
    expect(rows.map(r => r.text)).toEqual([`${RLI}אחת שתיים${PDI}`, `${RLI}שלוש ארבע${PDI}`])
  })

  test('surfaces that do bidi get isolates, not reordering', async () => {
    expect(toIsolated('הרץ `ls -la`', 'rtl')).toBe(`${RLI}הרץ \u2066\`ls -la\`${PDI}${PDI}`)
  })
})

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 60, scroll: { offset: 0, bodyRows: 9 }, view: {} } } as const

// The test's own hooks stand for the engine's prompt box: a fill lands
// whole and a read hands it back.
async function type($: Engine, on: On, text: string) {
  on('prompt.fill', () => ({ isFilled: true }))
  on('prompt.read', () => ({ value: { text, cursor: text.length } }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })
  await $.prompt.fill({ text, mode: 'replace', origin: { kind: 'plugin', name: 'test' } })
}

describe('prompt mirror', () => {
  test('a Hebrew draft is mirrored right-aligned above the prompt', async ($, on) => {
    await type($, on, 'שלום world')
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'hebrew-rtl', surface, ...BAND })
      const text = surface === 'terminal' ? 'world םולש' : `${RLI}שלום world${PDI}`
      expect(await ui.find({ type: 'Text', text })).toBeDefined()
      await ui.unmount()
    }
  })

  test('an English draft leaves the band to the engine', async ($, on) => {
    await type($, on, 'hello')
    const ui = await $.ui.mount({ plugin: 'hebrew-rtl', surface: 'terminal', ...BAND })
    expect(await ui.find({ type: 'Text', text: 'hello' })).toBeUndefined()
    await ui.unmount()
  })
})

describe('sent messages', () => {
  test('a Hebrew prompt in the transcript is drawn right-to-left', async ($) => {
    const props = { text: 'בדוק את `src/index.js`', origin: { kind: 'composer' }, isExpanded: true } as const
    const ui = await $.ui.mount({ plugin: 'hebrew-rtl', surface: 'terminal', component: 'UserMessage', props })
    expect(await ui.find({ type: 'Text', text: '`src/index.js` תא קודב' })).toBeDefined()
    await ui.unmount()
  })
})
