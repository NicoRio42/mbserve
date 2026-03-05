import type { StyleSpecification } from "maplibre-gl";
import { z } from "zod";
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
};

type NormalizedConfig = RawTileJson & {
  center?: [number, number];
  zoom?: number;
  bounds?: [number, number, number, number];
  minzoom?: number;
  maxzoom?: number;
  osm: boolean;
};

const finiteNumberSchema = z.number().finite();
const zoomSchema = finiteNumberSchema.transform((value) => clamp(value, 0, 24));
const centerSchema = z
  .tuple([finiteNumberSchema, finiteNumberSchema])
  .rest(z.unknown())
  .transform(
    ([lng, lat]) =>
      [clamp(lng, -180, 180), clamp(lat, -85.051129, 85.051129)] as [
        number,
        number,
      ],
  );
const centerZoomSchema = z
  .tuple([z.unknown(), z.unknown(), z.unknown()])
  .rest(z.unknown())
  .transform(([, , zoom]) => zoom)
  .pipe(zoomSchema);
const boundsSchema = z
  .tuple([
    finiteNumberSchema,
    finiteNumberSchema,
    finiteNumberSchema,
    finiteNumberSchema,
  ])
  .refine(
    ([minLng, minLat, maxLng, maxLat]) => minLng < maxLng && minLat < maxLat,
  )
  .refine(
    ([minLng, minLat, maxLng, maxLat]) =>
      minLng >= -180 &&
      maxLng <= 180 &&
      minLat >= -85.051129 &&
      maxLat <= 85.051129,
  );
const vectorLayerSchema = z.object({ id: z.string() });
const vectorLayersSchema = z.array(vectorLayerSchema).nonempty();
const vectorLayersMetadataSchema = z.object({
  vector_layers: vectorLayersSchema,
});
const jsonStringSchema = z.string().transform((value, context): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid JSON string",
    });
    return z.NEVER;
  }
});

export const configPromise = fetchConfig().then(normalizeConfig);

async function fetchConfig(): Promise<RawTileJson> {
  const response = await fetch("/config");

  if (!response.ok) {
    throw new Error(`Failed to fetch /config: ${response.status}`);
  }

  return (await response.json()) as RawTileJson;
}

function normalizeConfig(config: RawTileJson): NormalizedConfig {
  const center = parseOptional(centerSchema, config.center);
  const zoom =
    parseOptional(centerZoomSchema, config.center) ??
    parseOptional(zoomSchema, config.minzoom);
  const bounds = parseOptional(boundsSchema, config.bounds);
  const minzoom = parseOptional(zoomSchema, config.minzoom);
  const maxzoom = parseOptional(zoomSchema, config.maxzoom);

  return {
    ...config,
    center,
    zoom,
    bounds,
    minzoom,
    maxzoom,
    osm: parseOptional(z.boolean(), config.osm) ?? false,
  };
}

export function buildStyleFromConfig(
  config: NormalizedConfig,
  options: { terrainPreview?: boolean } = {},
): StyleSpecification {
  if (config.encoding) {
    const terrainPreview = options.terrainPreview ?? true;

    return {
      version: 8,
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
        mbtiles: terrainPreview
          ? {
              type: "raster-dem" as const,
              tiles: ["/tiles/{z}/{x}/{y}"],
              tileSize: 256,
              minzoom: config.minzoom,
              maxzoom: config.maxzoom,
              attribution: config.attribution,
              encoding: config.encoding,
            }
          : {
              type: "raster" as const,
              tiles: ["/tiles/{z}/{x}/{y}"],
              tileSize: 256,
              minzoom: config.minzoom,
              maxzoom: config.maxzoom,
              attribution: config.attribution,
            },
      },
      ...(terrainPreview
        ? {
            terrain: {
              source: "mbtiles",
              exaggeration: 1,
            },
          }
        : {}),
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
        ...(terrainPreview
          ? [
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
                type: "hillshade" as const,
                source: "mbtiles",
                paint: {
                  "hillshade-exaggeration": 0.7,
                },
              },
            ]
          : [
              {
                id: "mbtiles-raster",
                type: "raster" as const,
                source: "mbtiles",
              },
            ]),
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

function parseOptional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getVectorLayerIds(tileJson: RawTileJson): string[] {
  const directVectorLayers = parseOptional(
    vectorLayersSchema,
    tileJson.vector_layers,
  );
  if (directVectorLayers) {
    return directVectorLayers.map((layer) => layer.id);
  }

  const parsedJson = parseOptional(jsonStringSchema, tileJson.json);
  const parsedMetadata = parseOptional(vectorLayersMetadataSchema, parsedJson);
  if (parsedMetadata) {
    return parsedMetadata.vector_layers.map((layer) => layer.id);
  }

  return [];
}
