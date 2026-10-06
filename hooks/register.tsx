import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface, ResolveInput } from 'claude-code'

import type { Draft } from '../types'
import { hasHebrew, layout } from './bidi'
import type { Row } from './bidi'

// The prompt box itself is drawn by the engine, so the draft is mirrored in
// the band above it, laid out right-to-left whenever it holds Hebrew.
const draft = atom({ plugin: 'hebrew-rtl', key: 'draft' } as const, '' as Draft)

async function keepDraft($: EngineInterface, text: string): Promise<void> {
  await update($, draft, () => text)
}

function drawRows($: EngineInterface, e: ResolveInput, rows: Row[], width: number) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box flexDirection="column" width={width}>
      {rows.map((row, i) => (
        <Box key={`row-${i}`} width={width} justifyContent={row.dir === 'rtl' ? 'flex-end' : 'flex-start'}>
          <Text dimColor={row.isCode} wrap="truncate-end">
            {row.text === '' ? ' ' : row.text}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

export const register: Register = (on, options) => {
  const isTerminalBidi = options.terminalBidi === true

  // Only a plain terminal needs the characters put in display order; every
  // other surface, and a bidi-aware terminal, orders them itself.
  const reorderOn = (surface: RenderSurface): boolean => surface === 'terminal' && !isTerminalBidi

  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    await keepDraft($, box.text)

    return box
  })

  on('prompt.fill', async ($, e, next) => {
    const result = await next(e)
    const box = await $.prompt.read()
    await keepDraft($, box.text)

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    await keepDraft($, '')

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = await read($, draft)
    if (e.props.hasSurvey || !hasHebrew(text)) {
      return next(e)
    }

    const width = Math.max(10, e.props.bodyColumns)
    const rows = layout(text, { width, reorder: reorderOn(e.surface) })
    const room = Math.max(1, e.props.maxRows)

    return drawRows($, e, rows.slice(-room), width)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const isPrompt = e.props.origin.kind === 'composer' || e.props.origin.kind === 'bridge'
    if (!isPrompt || !hasHebrew(e.props.text)) {
      return next(e)
    }

    const width = Math.max(10, (e.viewport?.columns ?? 80) - 4)
    const rows = layout(e.props.text, { width, reorder: reorderOn(e.surface) })

    return drawRows($, e, rows, width)
  })
}
