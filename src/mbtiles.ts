import { Database, Statement } from "bun:sqlite";

export type TileJson = {
  name?: string;
  format?: string;
  bounds?: [number, number, number, number];
  center?: [number, number, number];
  minzoom?: number;
  maxzoom?: number;
  description?: string;
  type?: string;
  version?: string;
  attribution?: string;
  sparse?: boolean;
  encoding?: "mapbox" | "terrarium";
  [key: string]: unknown;
};

export class Mbtiles {
  private db: Database;
  private getTilePreparedStatement: Statement;

  constructor(path: string) {
    this.db = new Database(path);
    this.getTilePreparedStatement = this.db.prepare(
      "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
    );
  }

  getTile(z: number, x: number, y: number): Uint8Array | null {
    // MBTiles uses TMS y-coordinate, flip from ZXY (slippy map)
    const tmsY = (1 << z) - 1 - y;
    const row = this.getTilePreparedStatement.get(z, x, tmsY) as {
      tile_data: Uint8Array;
    } | null;

    return row?.tile_data ?? null;
  }

  getTileJson(): TileJson {
    const rows = this.db.prepare("SELECT name, value FROM metadata").all() as {
      name: string;
      value: string;
    }[];

    const tileJson: TileJson = {};

    for (const { name, value } of rows) {
      switch (name) {
        case "bounds": {
          const parts = value.split(",").map(Number);
          if (parts.length === 4) {
            tileJson.bounds = parts as [number, number, number, number];
          }
          break;
        }
        case "center": {
          const parts = value.split(",").map(Number);
          if (parts.length === 3) {
            tileJson.center = parts as [number, number, number];
          }
          break;
        }
        case "minzoom":
          tileJson.minzoom = Number(value);
          break;
        case "maxzoom":
          tileJson.maxzoom = Number(value);
          break;
        case "sparse":
          tileJson.sparse = value === "true";
          break;
        default:
          tileJson[name] = value;
          break;
      }
    }

    return tileJson;
  }
}
