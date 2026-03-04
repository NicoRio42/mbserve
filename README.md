# mbserve

A simple CLI to preview an `.mbtiles` file in a MapLibre GL map.

## Requirements

- [Bun](https://bun.sh/)

## Install

```bash
bun install
bun run install
```

This builds the binary and copies it to `~/.local/bin/mbserve`.

## Usage

```bash
mbserve /path/to/file.mbtiles
```

Enable an OpenStreetMap background:

```bash
mbserve /path/to/file.mbtiles --osm
```

Or run directly in dev mode:

```bash
bun run src/index.ts /path/to/file.mbtiles
```

The app starts a local HTTP server on a random available port, opens your browser automatically, and serves:

- `GET /` – map UI
- `GET /config` – metadata from MBTiles `metadata` plus runtime options (like `osm`)
- `GET /tiles/{z}/{x}/{y}` – tile endpoint

## Supported MBTiles content

- Vector tiles (`format: pbf`) → rendered with one line layer per vector layer
- Raster tiles (`png`, `jpg`/`jpeg`, `webp`) → rendered as raster source
- Raster DEM (`encoding: mapbox | terrarium`) → rendered with terrain + hillshade
