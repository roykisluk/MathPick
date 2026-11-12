// Math Pick — Math-o-mir-style "click a term to copy it into the current equation".
// Option+click a term in raw LaTeX  → that term is inserted at the cursor.
// Option+drag over raw text         → the dragged span is inserted.
// Option+click a rendered equation  → the whole equation is inserted.
const { Plugin, MarkdownView } = require("obsidian");
const { EditorView } = require("@codemirror/view");

// ---------- pure LaTeX term picker (tested in test.js) ----------

// Commands whose {args} are part of the term itself (clicking inside gives the whole term).
const DECOR = /^\\(underline|overline|hat|bar|tilde|dot|ddot|vec|widehat|widetilde|mathbb|mathcal|mathrm|mathbf|boldsymbol|operatorname\*?|text)$/;

function cmdEnd(s, i) { // s[i] === "\\"
  let j = i + 1;
  if (/[A-Za-z]/.test(s[j] || "")) { while (/[A-Za-z]/.test(s[j] || "")) j++; if (s[j] === "*") j++; }
  else j++;
  return j;
}
const skipWs = (s, j) => { while (s[j] === " ") j++; return j; };

// End index after the closer matching opener o at i. Other commands (\{, \lambda…) are skipped whole.
function close(s, i, o, c) {
  let d = 0;
  for (let j = i; j < s.length;) {
    if (s.startsWith(o, j)) { d++; j += o.length; }
    else if (s.startsWith(c, j)) { j += c.length; if (--d === 0) return j; }
    else if (s[j] === "\\") j = cmdEnd(s, j);
    else j++;
  }
  return s.length;
}

function arg(s, j) { // one sub/superscript argument
  j = skipWs(s, j);
  if (s[j] === "{") return close(s, j, "{", "}");
  if (s[j] === "\\") return cmdEnd(s, j);
  return j + 1;
}

// One term starting at i: {s, e, inner: [[a,b]...]} — inner ranges are recursed into.
function readTerm(s, i) {
  const c = s[i];
  let j, inner = [], callable = false;
  if (c === "\\") {
    const k = cmdEnd(s, i), name = s.slice(i, k);
    if (name === "\\left") {
      const d = s[k] === "\\" ? cmdEnd(s, k) : k + 1;   // after the \left delimiter
      j = close(s, i, "\\left", "\\right");              // just after "\right"
      const r = j - 6;
      inner.push([d, r]);
      j = s[j] === "\\" ? cmdEnd(s, j) : j + 1;          // \right delimiter
    } else if (name === "\\{") {
      j = close(s, i, "\\{", "\\}");
      inner.push([i + 2, j - 2]);
    } else if (DECOR.test(name)) {
      j = k;
      while (s[skipWs(s, j)] === "{") j = close(s, skipWs(s, j), "{", "}");
      callable = true;
    } else if (/^\\[A-Za-z]+\*?$/.test(name)) {
      j = k;
      while (s[skipWs(s, j)] === "{") { const g = skipWs(s, j); j = close(s, g, "{", "}"); inner.push([g + 1, j - 1]); }
      callable = inner.length === 0;  // \lambda, \rho … ; \frac{..}{..} is a container
    } else return null;               // \, \; \\ etc.
  } else if (/[A-Za-z0-9]/.test(c)) {
    j = i + 1;
    if (/\d/.test(c)) while (/[\d.]/.test(s[j] || "")) j++;
    callable = /[A-Za-z]/.test(c);
  } else if (c === "{") { j = close(s, i, "{", "}"); inner.push([i + 1, j - 1]); }
  else if (c === "(" || c === "[") { j = close(s, i, c, c === "(" ? ")" : "]"); inner.push([i + 1, j - 1]); }
  else return null;
  for (;;) { // subscripts, superscripts, primes
    const k = skipWs(s, j);
    if (s[k] === "_" || s[k] === "^") j = arg(s, k + 1);
    else if (s[k] === "'") j = k + 1;
    else break;
  }
  // ponytail: "(...)" right after a symbol counts as a function argument only if it holds no
  // + - = < > , — so V_{u}(a) is one term but p_{T}(\rho+\lambda_{s}) is not. Ambiguous by nature.
  if (callable && s[j] === "(") {
    const k = close(s, j, "(", ")");
    if (!/[+\-=<>,]/.test(s.slice(j + 1, k - 1))) { inner.push([j + 1, k - 1]); j = k; }
  }
  return { s: i, e: j, inner };
}

// The innermost meaningful term of LaTeX string s that covers character index pos.
function pickTerm(s, pos, from = 0, to = s.length) {
  let i = from;
  while (i < to) {
    const t = readTerm(s, i);
    if (!t) { i++; continue; }
    if (pos >= t.s && pos < t.e) {
      for (const [a, b] of t.inner) if (pos >= a && pos < b) { const r = pickTerm(s, pos, a, b); if (r) return r; }
      return s.slice(t.s, t.e);
    }
    i = t.e;
  }
  return null;
}

// Math ranges in a markdown doc: [{from, to}] of the LaTeX between the delimiters.
function mathRanges(doc) {
  const out = [], re = /\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g;
  for (let m; (m = re.exec(doc));) {
    const d = m[1] !== undefined ? 2 : 1;
    out.push({ start: m.index, end: m.index + m[0].length, from: m.index + d, to: m.index + m[0].length - d });
  }
  return out;
}

function wholeEquation(tex) {
  tex = tex.trim();
  if (tex.startsWith("{") && close(tex, 0, "{", "}") === tex.length) tex = tex.slice(1, -1).trim();
  return tex;
}

// ---------- Obsidian glue ----------

class MathPick extends Plugin {
  onload() {
    this.drag = null;
    this.swallowClick = false;
    const opts = { capture: true };
    this.registerDomEvent(window, "mousedown", (e) => this.down(e), opts);
    this.registerDomEvent(window, "mouseup", (e) => this.up(e), opts);
    this.registerDomEvent(window, "click", (e) => {
      if (this.swallowClick) { this.swallowClick = false; this.stop(e); }
    }, opts);
  }

  stop(e) { e.preventDefault(); e.stopImmediatePropagation(); }

  insert(text) {
    const editor = this.target;
    if (!editor || !text) return;
    editor.replaceSelection(text);
    editor.focus();
  }

  down(e) {
    if (!e.altKey || e.button !== 0) return;
    const cmEl = e.target.closest && e.target.closest(".cm-editor");
    if (!cmEl) return;                                  // Reading mode etc.
    const view = EditorView.findFromDOM(cmEl);
    const md = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !md) return;
    const doc = view.state.doc.toString();

    const widget = e.target.closest(".math, .cm-embed-block");
    if (widget) {                                       // rendered equation → whole equation
      const p = view.posAtDOM(widget);
      const r = mathRanges(doc).find((m) => p >= m.start && p <= m.end);
      if (!r) return;
      this.stop(e); this.swallowClick = true;
      this.target = md.editor;
      this.insert(wholeEquation(doc.slice(r.from, r.to)));
      return;
    }

    const pos = this.charAt(view, e);
    if (pos == null || !mathRanges(doc).some((m) => pos >= m.from && pos < m.to)) return;
    this.stop(e); this.swallowClick = true;
    this.target = md.editor;
    this.drag = { view, doc, pos, x: e.clientX, y: e.clientY };
  }

  up(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.stop(e);
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) {
      const r = mathRanges(d.doc).find((m) => d.pos >= m.from && d.pos < m.to);
      const t = pickTerm(d.doc.slice(r.from, r.to), d.pos - r.from);
      this.insert(t);
    } else {
      const p2 = d.view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (p2 == null) return;
      this.insert(d.doc.slice(Math.min(d.pos, p2), Math.max(d.pos, p2)).trim());
    }
  }

  // Index of the character under the mouse (posAtCoords gives the nearest gap between chars).
  charAt(view, e) {
    let pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos == null) return null;
    const c = view.coordsAtPos(pos);
    if (c && e.clientX < c.left && pos > 0) pos--;
    return pos;
  }
}

module.exports = MathPick;
module.exports.pickTerm = pickTerm;
module.exports.mathRanges = mathRanges;
module.exports.wholeEquation = wholeEquation;
