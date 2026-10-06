// A compact take on the Unicode Bidirectional Algorithm (UAX #9), enough for
// Hebrew prose mixed with English, numbers and inline code: paragraph
// direction from the first strong letter, weak and neutral resolution,
// reordering of runs (L2) and mirroring of brackets (L4). Code spans and
// fenced code blocks are held left-to-right as one unit.

export type Dir = 'rtl' | 'ltr'

type Kind = 'R' | 'L' | 'EN' | 'N'

/** One grapheme-ish cell: a base character and the combining marks on it. */
type Cell = { text: string; kind: Kind; isCode: boolean }

const HEBREW = /[\u0590-\u05FF\uFB1D-\uFB4F]/
const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/
const COMBINING = /[\u0300-\u036F\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u200C\u200D]/
const LETTER = /\p{L}/u
const DIGIT = /[0-9\u0660-\u0669\u06F0-\u06F9]/
// Separators that stay inside a number when they sit between two digits.
const NUMBER_JOINER = /[.,:/\-]/
const FENCE = /^\s*(```|~~~)/

const MIRROR: Record<string, string> = {
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{',
  '<': '>', '>': '<', '\u00AB': '\u00BB', '\u00BB': '\u00AB', '\u2039': '\u203A', '\u203A': '\u2039',
}

export const RLI = '\u2067'
export const LRI = '\u2066'
export const PDI = '\u2069'

export const hasHebrew = (text: string): boolean => HEBREW.test(text)

const kindOf = (ch: string): Kind => {
  if (RTL_LETTER.test(ch)) return 'R'
  if (DIGIT.test(ch)) return 'EN'
  if (LETTER.test(ch)) return 'L'

  return 'N'
}

/** Splits a line into cells, `code spans` marked as left-to-right units. */
const toCells = (line: string): Cell[] => {
  const cells: Cell[] = []
  let isCode = false

  for (const ch of Array.from(line)) {
    if (ch === '`') {
      isCode = !isCode
      cells.push({ text: ch, kind: 'L', isCode: true })
      continue
    }
    if (COMBINING.test(ch) && cells.length > 0) {
      cells[cells.length - 1]!.text += ch
      continue
    }
    cells.push({ text: ch, kind: isCode ? 'L' : kindOf(ch), isCode })
  }

  // Separators between two digits belong to the number (12:30, 3.5, 1,000).
  for (let i = 1; i < cells.length - 1; i++) {
    const cell = cells[i]!
    if (cell.kind === 'N' && NUMBER_JOINER.test(cell.text) && cells[i - 1]!.kind === 'EN' && cells[i + 1]!.kind === 'EN') {
      cell.kind = 'EN'
    }
  }

  return cells
}

/** The direction of the first strong letter, `undefined` when there is none. */
export const firstStrong = (line: string): Dir | undefined => {
  for (const cell of toCells(line)) {
    if (cell.kind === 'R') return 'rtl'
    if (cell.kind === 'L') return 'ltr'
  }

  return undefined
}

/** Embedding level of every cell in a paragraph of direction `dir`. */
const levelsOf = (cells: Cell[], dir: Dir): number[] => {
  const base = dir === 'rtl' ? 'R' : 'L'
  const resolved: Kind[] = cells.map(c => c.kind)

  // W7: a number after a left-to-right letter (or at the start of an LTR
  // paragraph) reads as left-to-right text.
  let lastStrong: Kind = base
  for (let i = 0; i < resolved.length; i++) {
    const kind = resolved[i]
    if (kind === 'L' || kind === 'R') lastStrong = kind
    else if (kind === 'EN' && lastStrong === 'L') resolved[i] = 'L'
  }

  // N1/N2: a run of neutrals takes the direction of the text on both sides
  // when they agree (numbers count as R), else the paragraph's.
  const strongOf = (kind: Kind): 'L' | 'R' => (kind === 'L' ? 'L' : 'R')
  let i = 0
  while (i < resolved.length) {
    if (resolved[i] !== 'N') {
      i++
      continue
    }
    let j = i
    while (j < resolved.length && resolved[j] === 'N') j++
    const before = i === 0 ? base : strongOf(resolved[i - 1]!)
    const after = j === resolved.length ? base : strongOf(resolved[j]!)
    const kind: Kind = before === after ? before : base
    for (let k = i; k < j; k++) resolved[k] = kind
    i = j
  }

  const levels = resolved.map(kind => {
    if (dir === 'rtl') return kind === 'R' ? 1 : 2
    if (kind === 'R') return 1
    if (kind === 'EN') return 2

    return 0
  })

  // L1: trailing whitespace goes back to the paragraph level.
  const baseLevel = dir === 'rtl' ? 1 : 0
  for (let k = cells.length - 1; k >= 0 && /^\s+$/.test(cells[k]!.text); k--) {
    levels[k] = baseLevel
  }

  return levels
}

/**
 * The line in display order, for a terminal that draws characters left to
 * right as they come: runs reversed by level (L2), brackets in right-to-left
 * runs mirrored (L4).
 */
export const toVisual = (line: string, dir: Dir): string => {
  const cells = toCells(line)
  const levels = levelsOf(cells, dir)
  const order = cells.map((_, k) => k)
  const top = Math.max(0, ...levels)

  for (let level = top; level >= 1; level--) {
    let k = 0
    while (k < order.length) {
      if (levels[order[k]!]! < level) {
        k++
        continue
      }
      let end = k
      while (end < order.length && levels[order[end]!]! >= level) end++
      const run = order.slice(k, end).reverse()
      order.splice(k, run.length, ...run)
      k = end
    }
  }

  return order
    .map(k => {
      const cell = cells[k]!
      const isMirrored = levels[k]! % 2 === 1 && !cell.isCode

      return isMirrored ? (MIRROR[cell.text] ?? cell.text) : cell.text
    })
    .join('')
}

/**
 * The line in logical order with isolates, for a surface that applies bidi
 * itself (a desktop page, a bidi-aware terminal): an RTL line wrapped in
 * RLI..PDI so its base direction is right-to-left, code spans in LRI..PDI.
 */
export const toIsolated = (line: string, dir: Dir): string => {
  const withCode = line.replace(/`[^`]*`/g, span => `${LRI}${span}${PDI}`)

  return dir === 'rtl' ? `${RLI}${withCode}${PDI}` : withCode
}

/** Display width in cells: combining marks take none. */
export const widthOf = (text: string): number =>
  Array.from(text).filter(ch => !COMBINING.test(ch)).length

/** Breaks a logical line into pieces of at most `width` cells, at spaces. */
export const wrapLogical = (line: string, width: number): string[] => {
  if (width < 1 || widthOf(line) <= width) return [line]

  const pieces: string[] = []
  let rest = line
  while (widthOf(rest) > width) {
    const chars = Array.from(rest)
    let cut = 0
    let cells = 0
    let lastSpace = -1
    while (cut < chars.length) {
      const add = COMBINING.test(chars[cut]!) ? 0 : 1
      if (cells + add > width) break
      cells += add
      if (chars[cut] === ' ') lastSpace = cut
      cut++
    }
    const at = lastSpace > 0 ? lastSpace : cut
    pieces.push(chars.slice(0, at).join('').trimEnd())
    rest = chars.slice(lastSpace > 0 ? at + 1 : at).join('')
  }
  pieces.push(rest)

  return pieces
}

export type Row = { text: string; dir: Dir; isCode: boolean }

export type LayoutOptions = {
  /** Cells per row; pieces wider than this are wrapped. */
  width: number
  /** True: reorder for a plain terminal. False: logical text with isolates. */
  reorder: boolean
}

/**
 * A message laid out as rows: each line's direction from its first strong
 * letter (a line with none follows the line before it, else the message's),
 * fenced code blocks left-to-right and untouched.
 */
export const layout = (text: string, { width, reorder }: LayoutOptions): Row[] => {
  const lines = text.split('\n')
  const messageDir: Dir = firstStrong(lines.find(l => firstStrong(l)) ?? '') ?? 'ltr'
  const rows: Row[] = []
  let inFence = false
  let previous: Dir = messageDir

  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence
      rows.push({ text: line, dir: 'ltr', isCode: true })
      continue
    }
    if (inFence) {
      rows.push({ text: line, dir: 'ltr', isCode: true })
      continue
    }

    const dir = firstStrong(line) ?? previous
    previous = dir
    for (const piece of wrapLogical(line, width)) {
      const shown = reorder ? toVisual(piece, dir) : toIsolated(piece, dir)
      rows.push({ text: dir === 'rtl' ? shown.trim() : shown.trimEnd(), dir, isCode: false })
    }
  }

  return rows
}
