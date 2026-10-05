'use strict';

function terms(text) {
  const stop = new Set('a an and are as at be by for from has in is it of on or that the this to was what when where which with you your about does do how why'.split(' '));
  return (text.toLowerCase().match(/[a-z0-9㐀-鿿]+/g) || []).filter(t => !stop.has(t));
}

function hash(text) {
  let h = 2166136261;
  for (const c of text) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function vector(text) {
  const v = Array(24).fill(0);
  for (const term of terms(text)) {
    const h = hash(term);
    v[h % 24] += 1;
    v[(h >>> 5) % 24] += 0.5;
  }
  const n = Math.hypot(...v) || 1;
  return v.map(x => x / n);
}

function cosine(a, b) {
  return a.reduce((sum, x, i) => sum + x * b[i], 0);
}

function splitText(text, chunkSize, overlap) {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
  if (!clean) return [];
  const parts = [];
  const isHigh = c => c >= 0xd800 && c <= 0xdbff;
  const isLow = c => c >= 0xdc00 && c <= 0xdfff;
  const isComb = c => (c >= 0x0300 && c <= 0x036f) || (c >= 0x1ab0 && c <= 0x1aff) || (c >= 0x1dc0 && c <= 0x1dff) || (c >= 0x20d0 && c <= 0x20ff) || (c >= 0xfe20 && c <= 0xfe2f);
  let start = 0;
  while (start < clean.length) {
    if (start > 0 && isHigh(clean.charCodeAt(start - 1)) && isLow(clean.charCodeAt(start))) start++;
    if (start >= clean.length) break;
    let from = start;
    while (from > 0 && isComb(clean.charCodeAt(from))) from--;
    let end = Math.min(clean.length, from + chunkSize);
    if (end < clean.length) {
      const boundary = Math.max(
        clean.lastIndexOf('\n', end),
        clean.lastIndexOf('. ', end),
        clean.lastIndexOf('。', end)
      );
      if (boundary > from + Math.floor(chunkSize * 0.55)) end = boundary + 1;
      if (isHigh(clean.charCodeAt(end - 1)) && isLow(clean.charCodeAt(end))) end--;
      while (end < clean.length && isComb(clean.charCodeAt(end))) end++;
    }
    parts.push(clean.slice(from, end).trim());
    if (end >= clean.length) break;
    // Advance the next chunk to `overlap` characters before this chunk's end.
    // The old code did `start += Math.max(1, end - overlap)`, adding the
    // absolute end offset to start; because start already equals the previous
    // chunk's start, every step past the first overshot by that offset and
    // silently dropped whole spans of input. Anchor the advance to `end` and
    // floor it at one character so the loop always makes progress.
    start = Math.max(start + 1, end - overlap);
  }
  return parts.filter(Boolean);
}

function scoreChunk(query, chunkTerms, chunkVector, lexicalWeight) {
  const q = terms(query);
  const overlap = q.reduce((n, t) => n + (chunkTerms.includes(t) ? 1 : 0), 0);
  const lexical = q.length ? overlap / q.length : 0;
  const semantic = cosine(vector(query), chunkVector);
  const w = Math.max(0, Math.min(1, lexicalWeight));
  return w * lexical + (1 - w) * semantic;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { terms, hash, vector, cosine, splitText, scoreChunk };
}
if (typeof globalThis !== 'undefined') {
  globalThis.RAGCore = { terms, hash, vector, cosine, splitText, scoreChunk };
}
