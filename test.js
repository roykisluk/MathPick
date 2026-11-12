// Parser check: node test.js  (stubs Obsidian's modules; tests the pure picker only)
const Module = require("module");
const load = Module._load;
Module._load = (r, ...a) => (r === "obsidian" ? { Plugin: class {}, MarkdownView: class {} }
  : r === "@codemirror/view" ? { EditorView: {} } : load(r, ...a));
const assert = require("assert");
const { pickTerm, mathRanges, wholeEquation } = require("./main.js");

// click at the first occurrence of `at` (offset k inside it)
const pick = (s, at, k = 0) => pickTerm(s, s.indexOf(at) + k);

const vu = String.raw`\rho V_{u}(a)=b+\sum_{i=1}^{N_{s}}\lambda_{i}^{u v}(\theta)[\operatorname*{m a x}\{V_{E i}(a)-V_{u}(a),0\}]`;
assert.strictEqual(pick(vu, String.raw`\lambda`), String.raw`\lambda_{i}^{u v}(\theta)`);
assert.strictEqual(pick(vu, String.raw`\theta`, 2), String.raw`\theta`);       // inside a function argument
assert.strictEqual(pick(vu, String.raw`\theta`, -1), String.raw`\lambda_{i}^{u v}(\theta)`);  // on its "("
assert.strictEqual(pick(vu, "V_{u}"), "V_{u}(a)");
assert.strictEqual(pick(vu, "V_{E i}", 4), "V_{E i}(a)");                 // click on the subscript
assert.strictEqual(pick(vu, String.raw`\sum`), String.raw`\sum_{i=1}^{N_{s}}`);
assert.strictEqual(pick(vu, String.raw`[\op`), vu.slice(vu.indexOf(String.raw`[\op`)));   // bracket → whole group
assert.strictEqual(pick(vu, String.raw`\{`), String.raw`\{V_{E i}(a)-V_{u}(a),0\}`);
assert.strictEqual(pick(vu, String.raw`\operatorname`), String.raw`\operatorname*{m a x}`);

const s = String.raw`S_{T}(\underline{R_{T}})=\frac{p_{T}l(\underline{R_{T}})-f_{T}-b}{\rho+ \lambda_{s}}=0`;
assert.strictEqual(pick(s, String.raw`\underline`), String.raw`\underline{R_{T}}`);
assert.strictEqual(pick(s, "R_{T}", 2), String.raw`\underline{R_{T}}`);        // inside decorator → whole
assert.strictEqual(pick(s, "p_{T}", 3), "p_{T}");                               // click the T
assert.strictEqual(pick(s, "l(", 0), String.raw`l(\underline{R_{T}})`);
assert.strictEqual(pick(s, String.raw`\frac`), s.slice(s.indexOf(String.raw`\frac`), s.lastIndexOf("=")));
assert.strictEqual(pick(s, String.raw`\lambda`), String.raw`\lambda_{s}`);    // inside \frac → inner term
assert.strictEqual(pick(s, "S_{T}"), String.raw`S_{T}(\underline{R_{T}})`);

const p = String.raw`p_{T}(\rho+\lambda_{s})>0`;
assert.strictEqual(pick(p, "p_{T}"), "p_{T}");                                  // no swallowing (\rho+...)
assert.strictEqual(pick(p, "("), String.raw`(\rho+\lambda_{s})`);

const l = String.raw`b+\lambda_{T}^{uv}(\theta)\left[ max\left\{  V_{ET}\left( \underline{R_{T}}-\frac{b}{\rho} \right)  \right\},0 \right]`;
assert.strictEqual(pick(l, String.raw`\left\{`), String.raw`\left\{  V_{ET}\left( \underline{R_{T}}-\frac{b}{\rho} \right)  \right\}`);
assert.strictEqual(pick(l, "V_{ET}"), "V_{ET}");

// markdown side: ranges, empty block, outer {…} wrapper
const doc = "x $a_1$ y\n$$\n\n$$\n$$\n{\\rho V_{u}=b}\n$$\n";
const r = mathRanges(doc);
assert.strictEqual(r.length, 3);
assert.strictEqual(doc.slice(r[0].from, r[0].to), "a_1");
assert.strictEqual(wholeEquation(doc.slice(r[1].from, r[1].to)), "");
assert.strictEqual(wholeEquation(doc.slice(r[2].from, r[2].to)), String.raw`\rho V_{u}=b`);

console.log("all passed");
