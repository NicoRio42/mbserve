import { Map, type StyleSpecification } from "maplibre-gl";

type RawTileJson = {
  name?: string;
  format?: string;
  bounds?: unknown;
  center?: unknown;
  minzoom?: unknown;
  maxzoom?: unknown;
  attribution?: string;
  vector_layers?: { id: string }[];
  json?: string;
};

type NormalizedTileJson = RawTileJson & {
  center?: [number, number];
  zoom?: number;
  bounds?: [number, number, number, number];
  minzoom?: number;
  maxzoom?: number;
};

const tileJson = normalizeTileJson(await fetchTileJson());
const fallbackCenter: [number, number] = [0, 0];

new Map({
  container: "map",
  style: buildStyleFromTileJson(tileJson),
  center: tileJson.center ?? fallbackCenter,
  zoom: tileJson.zoom ?? 2,
  ...(tileJson.bounds ? { maxBounds: tileJson.bounds } : {}),
});

async function fetchTileJson(): Promise<RawTileJson> {
  const response = await fetch("/tilejson");

  if (!response.ok) {
    throw new Error(`Failed to fetch /tilejson: ${response.status}`);
  }

  return (await response.json()) as RawTileJson;
}

function buildStyleFromTileJson(
  tileJson: NormalizedTileJson,
): StyleSpecification {
  const isVector = tileJson.format === "pbf";

  if (!isVector) {
    return {
      version: 8,
      sources: {
        mbtiles: {
          type: "raster",
          tiles: ["/tiles/{z}/{x}/{y}"],
          tileSize: 256,
          minzoom: tileJson.minzoom,
          maxzoom: tileJson.maxzoom,
          attribution: tileJson.attribution,
        },
      },
      layers: [
        {
          id: "mbtiles-raster",
          type: "raster",
          source: "mbtiles",
        },
      ],
    };
  }

  const vectorLayerIds = getVectorLayerIds(tileJson);

  return {
    version: 8,
    sources: {
      mbtiles: {
        type: "vector",
        tiles: ["/tiles/{z}/{x}/{y}"],
        minzoom: tileJson.minzoom,
        maxzoom: tileJson.maxzoom,
        attribution: tileJson.attribution,
      },
    },
    layers: vectorLayerIds.map((sourceLayerId) => ({
      id: `mbtiles-${sourceLayerId}`,
      type: "line" as const,
      source: "mbtiles",
      "source-layer": sourceLayerId,
    })),
  };
}

function normalizeTileJson(tileJson: RawTileJson): NormalizedTileJson {
  const center = toCenter(tileJson.center);
  const zoom =
    toCenterZoom(tileJson.center) ?? toFiniteNumber(tileJson.minzoom);
  const bounds = toBounds(tileJson.bounds);

  return {
    ...tileJson,
    center,
    zoom,
    bounds,
    minzoom: toFiniteNumber(tileJson.minzoom),
    maxzoom: toFiniteNumber(tileJson.maxzoom),
  };
}

function toCenterZoom(value: unknown): number | undefined {
  if (!Array.isArray(value) || value.length < 3) {
    return undefined;
  }

  return toFiniteNumber(value[2]);
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function toCenter(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }

  const lng = toFiniteNumber(value[0]);
  const lat = toFiniteNumber(value[1]);

  if (lng === undefined || lat === undefined) {
    return undefined;
  }

  return [lng, lat];
}

function toBounds(
  value: unknown,
): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 4) {
    return undefined;
  }

  const minLng = toFiniteNumber(value[0]);
  const minLat = toFiniteNumber(value[1]);
  const maxLng = toFiniteNumber(value[2]);
  const maxLat = toFiniteNumber(value[3]);

  if (
    minLng === undefined ||
    minLat === undefined ||
    maxLng === undefined ||
    maxLat === undefined
  ) {
    return undefined;
  }

  return [minLng, minLat, maxLng, maxLat];
}

function getVectorLayerIds(tileJson: RawTileJson): string[] {
  if (
    Array.isArray(tileJson.vector_layers) &&
    tileJson.vector_layers.length > 0
  ) {
    return tileJson.vector_layers.map((layer) => layer.id);
  }

  if (typeof tileJson.json !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(tileJson.json) as {
      vector_layers?: { id: string }[];
    };
    if (
      Array.isArray(parsed.vector_layers) &&
      parsed.vector_layers.length > 0
    ) {
      return parsed.vector_layers.map((layer) => layer.id);
    }
  } catch {
    return [];
  }

  return [];
}
