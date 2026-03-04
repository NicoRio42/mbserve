import { spawn } from "node:child_process";
import { exists } from "node:fs/promises";
import process from "node:process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Mbtiles } from "./mbtiles";
import index from "./ui/index.html";

const cliArgs = await yargs(hideBin(process.argv))
  .scriptName("mbserve")
  .usage("$0 <path-to-mbtiles> [options]")
  .positional("path-to-mbtiles", {
    describe: "Path to the .mbtiles file",
    type: "string",
  })
  .option("osm", {
    type: "boolean",
    default: false,
    describe: "Add an OpenStreetMap background layer",
  })
  .demandCommand(1, "You must provide a path to an .mbtiles file")
  .strict()
  .help()
  .parse();

const mbtilesPath = String(cliArgs._[0]);
const osm = cliArgs.osm;

if (!(await exists(mbtilesPath))) {
  console.error(`File ${mbtilesPath} does not exist`);
  process.exit(1);
}

const mbtiles = new Mbtiles(mbtilesPath);
const tileJson = mbtiles.getTileJson();
const tilesContentType = getTilesContentTypeFromFormat(tileJson.format);

const server = Bun.serve({
  port: 0,
  routes: {
    "/": index,
    "/tiles/:zoom/:x/:y": (req) => {
      const { zoom, x, y } = req.params;
      const tile = mbtiles.getTile(Number(zoom), Number(x), Number(y));

      if (!tile) {
        return new Response("Tile not found", { status: 404 });
      }

      return new Response(tile, {
        headers: {
          "Content-Type": tilesContentType,
        },
      });
    },
    "/config": () => {
      return new Response(JSON.stringify({ ...tileJson, osm }), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
  },
});

console.log(`Serving on ${server.url}`);
openBrowser(server.url.href);

function openBrowser(url: string) {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

function getTilesContentTypeFromFormat(format: string | undefined): string {
  switch (format) {
    case "pbf":
      return "application/x-protobuf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      console.warn(
        `Unknown tile format "${format}", defaulting to application/x-protobuf`,
      );
      return "application/x-protobuf";
  }
}
