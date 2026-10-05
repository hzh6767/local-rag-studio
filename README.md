# Local RAG Studio

A local-first retrieval-augmented generation workspace that runs entirely in the browser. Import text or Markdown documents, split them into overlapping chunks, build a searchable index, ask questions, inspect ranked evidence, and export the whole workspace as JSON.

## Why this project exists

Many RAG demos hide the important parts behind a hosted API. Local RAG Studio makes the pipeline visible: document ingestion, chunking, indexing, retrieval scoring, citation assembly, answer synthesis, and evaluation are all inspectable from one screen.

## Features

- Drag-and-drop or paste TXT, Markdown, CSV, JSON, and source files
- Configurable chunk size and overlap
- Hybrid retrieval using lexical-overlap scoring plus deterministic hashed semantic vectors
- Source citations with document name, chunk number, and relevance score
- Local extractive answer synthesis without an API key
- Provider adapter settings placeholder (not functional in this static build)
- Retrieval playground with top-k and lexical/semantic weighting controls
- Built-in evaluation set with hit-rate and mean reciprocal rank
- Indexed-document explorer with document deletion
- Workspace persistence in localStorage
- JSON workspace export
- Responsive keyboard-friendly interface

## Run

Open `index.html` in a modern browser. No build step, server, account, dependency, telemetry, or API key is required.

For a local HTTP server you can use any static server, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Retrieval pipeline

1. Files are decoded in the browser and normalized.
2. Text is split into overlapping chunks on paragraph and sentence boundaries.
3. Each chunk receives term-frequency statistics and a deterministic hashed vector.
4. Queries are scored with a weighted combination of lexical overlap and cosine similarity.
5. The answer panel extracts the strongest supporting sentences and emits numbered citations.

The local vectorizer is intentionally deterministic and dependency-free. It is useful for prototyping and offline search, but it is not a replacement for a production embedding model. The provider settings panel describes how an OpenAI-compatible adapter can be connected in a server-backed deployment without exposing credentials in the browser.

## Privacy

Documents and settings remain in the browser. Network access is not used by the default local engine. Clearing site storage removes the saved workspace.

## Project structure

- `index.html` — complete application, styling, local index, evaluation tools, and persistence
- `rag-core.js` — pure retrieval core (tokenizing, hashing, vectors, chunk splitting, scoring), shared by the app and the tests
- `tests/rag-core.test.js` — dependency-free tests for the retrieval core
- `.github/workflows/ci.yml` — CI that runs `npm test` on Node.js 18
- `README.md` — architecture and usage guide
- `LICENSE` — MIT license

## Tests

The retrieval core has no dependencies; run its tests with Node.js 18 or newer:

```bash
npm test
```

## Security notes

Imported content is rendered through text nodes rather than HTML. API secrets are not stored or required.

## License

MIT © 2026 无聊玩玩 (hzh6767).
