# MathPick — Obsidian plugin

Math-o-mir-style term picking for Roy's Obsidian vault (iCloud, `iCloud~md~obsidian/Documents`).
- **Option+click** a term in raw LaTeX (Source mode, or the equation being edited) → inserted at the cursor.
- **Option+drag** over raw text → the dragged span is inserted.
- **Option+click a rendered equation** → the whole equation (outer `{…}` stripped) is inserted.

## Rules
- Source of truth is this folder. `./install.sh` runs `node test.js` then copies `main.js` + `manifest.json`
  into the vault's `.obsidian/plugins/math-pick/`. Never edit the vault copy.
- Plain JS, no build step. Obsidian's loader can't resolve relative `require`, so everything stays in `main.js`.
- Don't edit the vault's `community-plugins.json` or plugin `data.json` while Obsidian is running —
  it holds them in memory and overwrites them. Enable/configure in the app.
- `isDesktopOnly: true` — the vault syncs to iOS.
- Option, not Ctrl: on a Mac Ctrl+click is right-click.

## Term rule (pickTerm)
Smallest term under the click. Sub/superscripts, primes and decorator args (`\underline{}`, `\hat{}`,
`\operatorname*{}`…) belong to the term. Containers (`\frac{}{}`, brackets, `\left…\right`, `\{…\}`,
function-call args) are recursed into, so clicking a bracket gives the whole group and clicking inside gives the inner term.
`(…)` after a symbol counts as its argument only if it holds no `+ - = < > ,` (heuristic, marked `ponytail:`).

## Lesson log
- 2026-11-12 — Built. No existing plugin among the 10,269 in obsidian-releases does click-to-insert
  (searched descriptions for latex/mathjax + click/insert/copy/macro). Parser tested (node test.js + a sweep over
  every position of "Two-sector model notes.md": 87 blocks, 7645 clicks, no crash). **In-app event handling
  (capture-phase mousedown/mouseup/click on window, posAtDOM for rendered widgets) is NOT yet verified in Obsidian.**
- 2026-11-12 — Design choice: clicking inside a function argument (`S_T(\underline{R_T})`) picks the argument,
  not the whole call; click the symbol or the `(` to get the whole call.
