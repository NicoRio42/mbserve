# Agent Instructions

## Project overview

- `mbserve` is a Bun-based CLI that serves an `.mbtiles` file and opens a local map preview.
- Backend entrypoint: `src/index.ts` (CLI args, Bun HTTP routes, browser open).
- MBTiles access: `src/mbtiles.ts` (`bun:sqlite`, metadata + tile lookup).
- Frontend UI: `src/ui/` (React + MapLibre map renderer).

## Tech stack

- Runtime/build: Bun
- Language: TypeScript (strict mode)
- Backend: Bun server APIs + `bun:sqlite`
- CLI parsing: `yargs`
- Frontend: React 19, `react-map-gl`, MapLibre GL
- Validation/parsing: `zod`
- Styling: Tailwind CSS (via Bun plugin)

## Agent workflow

- Install deps with `bun install`.
- Run `bun check` to validate TypeScript errors before finishing changes.
- Keep changes focused and minimal; do not add unrelated refactors.
