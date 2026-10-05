'use strict';
const { terms, hash, vector, cosine, splitText, scoreChunk } = require('../rag-core.js');

function assert(condition, message) {
  if (!condition) throw new Error('Assertion failed: ' + message);
}

function assertEq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`Assertion failed: ${message}\n  Expected: ${expected} ±${tolerance}\n  Actual: ${actual}`);
  }
}

console.log('Running rag-core tests...');

// Test terms extraction
{
  const result = terms('Hello WORLD and test');
  assert(result.includes('hello'), 'terms: should include hello');
  assert(result.includes('world'), 'terms: should include world');
  assert(result.includes('test'), 'terms: should include test');
  assert(!result.includes('and'), 'terms: should exclude stopword and');
  console.log('✓ terms extraction');
}

// Test hash consistency
{
  const h1 = hash('test');
  const h2 = hash('test');
  assertEq(h1, h2, 'hash: should be deterministic');
  assert(hash('test') !== hash('TEST'), 'hash: should be case-sensitive');
  console.log('✓ hash consistency');
}

// Test vector normalization
{
  const v = vector('machine learning');
  assert(v.length === 24, 'vector: should have 24 dimensions');
  const magnitude = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  assertClose(magnitude, 1.0, 0.001, 'vector: should be normalized');
  console.log('✓ vector normalization');
}

// Test cosine similarity
{
  const a = [1, 0, 0];
  const b = [1, 0, 0];
  const c = [0, 1, 0];
  assertEq(cosine(a, b), 1, 'cosine: identical vectors should score 1');
  assertEq(cosine(a, c), 0, 'cosine: orthogonal vectors should score 0');
  console.log('✓ cosine similarity');
}

// Test splitText basic
{
  const text = 'First sentence. Second sentence.';
  const chunks = splitText(text, 20, 5);
  assert(chunks.length > 0, 'splitText: should produce chunks');
  assert(chunks.every(c => c.length > 0), 'splitText: chunks should not be empty');
  console.log('✓ splitText basic');
}

// Test splitText terminates when overlap >= size
{
  const text = 'A'.repeat(1000);
  const chunks = splitText(text, 50, 60);
  // Overlap larger than the chunk size forces a one-character advance per step,
  // so the loop must still terminate and must not lose the tail of the input.
  assert(chunks.length > 0, 'splitText: should produce chunks when overlap > size');
  assert(chunks.join('').includes(text.slice(-50)), 'splitText: should reach the end when overlap > size');
  console.log('✓ splitText overlap > size termination');
}

// Test splitText does not skip input spans (regression)
{
  // Regression: the advance used to add the absolute `end` offset to `start`,
  // jumping past (end - overlap) characters on every step after the first, so
  // middle and tail spans vanished from the index entirely.
  assertEq(JSON.stringify(splitText('abcdefghij', 3, 0)), JSON.stringify(['abc', 'def', 'ghi', 'j']), 'splitText: overlap 0 should tile the input');
  assertEq(JSON.stringify(splitText('abcdef', 1, 0)), JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']), 'splitText: size 1 should keep every character');
  assertEq(JSON.stringify(splitText('abcdefghijkl', 4, 0)), JSON.stringify(['abcd', 'efgh', 'ijkl']), 'splitText: should not drop the final span');
  const text = ('Sentence one. Sentence two! 中文句子。').repeat(20);
  const joined = splitText(text, 40, 0).join('');
  assertEq(joined, text, 'splitText: overlap 0 chunks should reconstruct the input exactly');
  console.log('✓ splitText span coverage');
}

// Test splitText boundary detection
{
  const text = 'First paragraph.\nSecond paragraph.';
  const chunks = splitText(text, 25, 5);
  assert(chunks.some(c => c.includes('First')), 'splitText: should include first paragraph');
  assert(chunks.some(c => c.includes('Second')), 'splitText: should include second paragraph');
  console.log('✓ splitText boundary detection');
}

// Test splitText does not split surrogate pairs
{
  const emoji = String.fromCodePoint(0x1f600).repeat(200);
  const isLone = s => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) {
        const n = s.charCodeAt(i + 1);
        if (!(n >= 0xdc00 && n <= 0xdfff)) return true;
      } else if (c >= 0xdc00 && c <= 0xdfff) {
        const p = s.charCodeAt(i - 1);
        if (!(p >= 0xd800 && p <= 0xdbff)) return true;
      }
    }
    return false;
  };
  let split = false;
  for (const size of [181, 183, 51, 53]) {
    for (const overlap of [0, 1, 80]) {
      if (splitText(emoji, size, overlap).some(isLone)) split = true;
    }
  }
  assert(!split, 'splitText: should not produce lone surrogates');
  console.log('✓ splitText surrogate safety');
}

// Test splitText empty input
{
  assertEq(splitText('', 480, 80).length, 0, 'splitText: empty input should yield no chunks');
  assertEq(splitText('   \n\t  ', 480, 80).length, 0, 'splitText: whitespace-only input should yield no chunks');
  console.log('✓ splitText empty input');
}

// Test scoreChunk
{
  const query = 'machine learning';
  const chunkTerms = ['machine', 'learning', 'algorithm'];
  const chunkVector = vector('machine learning algorithm');
  const score = scoreChunk(query, chunkTerms, chunkVector, 0.5);
  assert(score > 0 && score <= 1, 'scoreChunk: should return normalized score');
  console.log('✓ scoreChunk');
}

// Test scoreChunk lexical weight
{
  const query = 'test';
  const chunkTerms = ['test'];
  const chunkVector = vector('test');
  const score100 = scoreChunk(query, chunkTerms, chunkVector, 1.0);
  const score0 = scoreChunk(query, chunkTerms, chunkVector, 0.0);
  assert(score100 > 0, 'scoreChunk: 100% lexical should score > 0');
  assert(score0 > 0, 'scoreChunk: 100% semantic should score > 0');
  console.log('✓ scoreChunk lexical weight');
}

// Test terms keeps single-character keywords
{
  assert(terms('C').includes('c'), 'terms: should keep single-character keyword C');
  assert(terms('猫').includes('猫'), 'terms: should keep single-character CJK keyword');
  assert(terms('5').includes('5'), 'terms: should keep single-digit keyword');
  assert(!terms('a').includes('a'), 'terms: should still drop the stopword a');
  console.log('✓ terms single-character keywords');
}

// Test splitText does not orphan combining marks
{
  const isComb = c => (c >= 0x0300 && c <= 0x036f) || (c >= 0x1ab0 && c <= 0x1aff) || (c >= 0x1dc0 && c <= 0x1dff) || (c >= 0x20d0 && c <= 0x20ff) || (c >= 0xfe20 && c <= 0xfe2f);
  const cluster = 'e' + String.fromCharCode(0x0301);
  let orphaned = false;
  for (const size of [2, 3, 7, 180]) {
    for (const overlap of [0, 1, 80, 179]) {
      const chunks = splitText(cluster.repeat(40), size, overlap);
      if (chunks.some(c => c.length && isComb(c.charCodeAt(0)))) orphaned = true;
    }
  }
  assert(!orphaned, 'splitText: should not start a chunk with an orphan combining mark');
  console.log('✓ splitText combining mark safety');
}

console.log('\nAll tests passed!');
