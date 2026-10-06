# hebrew-rtl

A Claude Code mod that shows Hebrew right-to-left and right-aligned, while code and English stay left-to-right.

## What it does

- **Prompt mirror:** Claude Code does not let a plugin redraw the prompt box itself, so while the draft contains Hebrew, a live mirror of it is drawn in the band above the prompt, laid out right-to-left.
- **Sent messages:** your Hebrew prompts in the transcript are drawn right-to-left and right-aligned.
- **Per-line direction** from the first strong letter (Unicode Bidirectional Algorithm): a line that starts in Hebrew is RTL, a line that starts in English stays LTR with any Hebrew word inside it in the right order.
- **Mixed text:** English words, numbers (`12:30`, `1,000`) and paths keep their order inside Hebrew sentences; brackets around Hebrew are mirrored.
- **Code stays LTR:** inline `` `code` `` is one left-to-right unit, and fenced ``` blocks are left untouched and left-aligned.
- **Per surface:** on a plain terminal the mod puts characters in display order itself; on the desktop app and VS Code it adds Unicode isolates and lets the renderer do the ordering.

## Install

At the prompt of a Claude Code session:

```
/plugin install hebrew-rtl --marketplace hemichaeli/hebrew-rtl
```

Answer `y` to add the marketplace, then choose a scope (user scope is first; press Enter).

## Option

`terminalBidi` (in `/config`, default off): turn it on if your terminal already reorders bidi text itself (GNOME Terminal, Konsole, mlterm). The mod then only aligns, so the text is not reversed twice.

## Development

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```
