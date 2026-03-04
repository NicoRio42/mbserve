import { Map, type StyleSpecification } from "maplibre-gl";
import type { TileJson } from "../mbtiles";

type RawTileJson = Omit<
  TileJson,
  "bounds" | "center" | "minzoom" | "maxzoom"
> & {
  attribution?: string;
  bounds?: unknown;
  center?: unknown;
  minzoom?: unknown;
  maxzoom?: unknown;
  vector_layers?: { id: string }[];
  encoding?: "mapbox" | "terrarium";
  json?: string;
  osm?: unknown;
};

type NormalizedConfig = RawTileJson & {
  center?: [number, number];
  zoom?: number;
  bounds?: [number, number, number, number];
  minzoom?: number;
  maxzoom?: number;
  osm: boolean;
};

const config = normalizeConfig(await fetchConfig());
const fallbackCenter: [number, number] = [0, 0];

const map = new Map({
  container: "map",
  style: buildStyleFromConfig(config),
  center: config.center ?? fallbackCenter,
  zoom: config.zoom ?? 2,
  maxPitch: 85,
  hash: true,
  ...(config.encoding ? { pitch: 60, bearing: -20 } : {}),
  ...(config.bounds ? { maxBounds: config.bounds } : {}),
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    map.remove();
  });
}

async function fetchConfig(): Promise<RawTileJson> {
  const response = await fetch("/config");

  if (!response.ok) {
    throw new Error(`Failed to fetch /config: ${response.status}`);
  }

  return (await response.json()) as RawTileJson;
}

function buildStyleFromConfig(config: NormalizedConfig): StyleSpecification {
  if (config.encoding) {
    return {
      version: 8,
      projection: {
        type: "globe",
      },
      sources: {
        ...(config.osm
          ? {
              osm: {
                type: "raster" as const,
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                maxzoom: 19,
                attribution: "© OpenStreetMap contributors",
              },
            }
          : {}),
        mbtiles: {
          type: "raster-dem",
          tiles: ["/tiles/{z}/{x}/{y}"],
          tileSize: 256,
          minzoom: config.minzoom,
          maxzoom: config.maxzoom,
          attribution: config.attribution,
          encoding: config.encoding,
        },
      },
      terrain: {
        source: "mbtiles",
        exaggeration: 1,
      },
      layers: [
        ...(config.osm
          ? [
              {
                id: "osm-background",
                type: "raster" as const,
                source: "osm",
              },
            ]
          : []),
        ...(!config.osm
          ? [
              {
                id: "terrain-background",
                type: "background" as const,
                paint: {
                  "background-color": "#0f172a",
                },
              },
            ]
          : []),
        {
          id: "terrain-hillshade",
          type: "hillshade",
          source: "mbtiles",
          paint: {
            "hillshade-exaggeration": 0.7,
          },
        },
      ],
    };
  }

  const isVector = config.format === "pbf";

  if (!isVector) {
    return {
      version: 8,
      projection: {
        type: "globe",
      },
      sources: {
        ...(config.osm
          ? {
              osm: {
                type: "raster" as const,
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                maxzoom: 19,
                attribution: "© OpenStreetMap contributors",
              },
            }
          : {}),
        mbtiles: {
          type: "raster",
          tiles: ["/tiles/{z}/{x}/{y}"],
          tileSize: 256,
          minzoom: config.minzoom,
          maxzoom: config.maxzoom,
          attribution: config.attribution,
        },
      },
      layers: [
        ...(config.osm
          ? [
              {
                id: "osm-background",
                type: "raster" as const,
                source: "osm",
              },
            ]
          : []),
        {
          id: "mbtiles-raster",
          type: "raster",
          source: "mbtiles",
        },
      ],
    };
  }

  const vectorLayerIds = getVectorLayerIds(config);

  return {
    version: 8,
    projection: {
      type: "globe",
    },
    sources: {
      ...(config.osm
        ? {
            osm: {
              type: "raster" as const,
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: "© OpenStreetMap contributors",
            },
          }
        : {}),
      mbtiles: {
        type: "vector",
        tiles: ["/tiles/{z}/{x}/{y}"],
        minzoom: config.minzoom,
        maxzoom: config.maxzoom,
        attribution: config.attribution,
      },
    },
    layers: [
      ...(config.osm
        ? [
            {
              id: "osm-background",
              type: "raster" as const,
              source: "osm",
            },
          ]
        : []),
      ...vectorLayerIds.map((sourceLayerId) => ({
        id: `mbtiles-${sourceLayerId}`,
        type: "line" as const,
        source: "mbtiles",
        "source-layer": sourceLayerId,
      })),
    ],
  };
}

function normalizeConfig(config: RawTileJson): NormalizedConfig {
  const center = toCenter(config.center);
  const zoom = toValidZoom(
    toCenterZoom(config.center) ?? toFiniteNumber(config.minzoom),
  );
  const bounds = toBounds(config.bounds);
  const minzoom = toValidZoom(toFiniteNumber(config.minzoom));
  const maxzoom = toValidZoom(toFiniteNumber(config.maxzoom));

  return {
    ...config,
    center,
    zoom,
    bounds,
    minzoom,
    maxzoom,
    osm: toBoolean(config.osm),
  };
}

function toBoolean(value: unknown): boolean {
  return value === true;
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

  return [clamp(lng, -180, 180), clamp(lat, -85.051129, 85.051129)];
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

  if (minLng >= maxLng || minLat >= maxLat) {
    return undefined;
  }

  if (
    minLng < -180 ||
    maxLng > 180 ||
    minLat < -85.051129 ||
    maxLat > 85.051129
  ) {
    return undefined;
  }

  return [minLng, minLat, maxLng, maxLat];
}

function toValidZoom(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return clamp(value, 0, 24);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
