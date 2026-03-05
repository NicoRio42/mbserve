import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useMap } from "react-map-gl/maplibre";

type GridPreviewProps = {
  enabled: boolean;
};

const MAX_TILE_LABELS = 450;

export function GridPreview({ enabled }: GridPreviewProps) {
  const { current: mapRef } = useMap();
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    const map = mapRef?.getMap();

    if (!map || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;

    const draw = () => {
      drawGridOverlay(canvas, map, enabled);
    };

    draw();

    map.on("move", draw);
    map.on("resize", draw);
    map.on("zoom", draw);
    map.on("rotate", draw);
    map.on("pitch", draw);

    return () => {
      map.off("move", draw);
      map.off("resize", draw);
      map.off("zoom", draw);
      map.off("rotate", draw);
      map.off("pitch", draw);
    };
  }, [enabled, mapRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        display: enabled ? "block" : "none",
      }}
      aria-hidden="true"
    />
  );
}

function drawGridOverlay(
  canvas: any,
  map: MapLibreMap,
  enabled: boolean,
): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  syncCanvasSize(canvas, map);
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!enabled) {
    return;
  }

  const zoom = Math.max(0, Math.floor(map.getZoom()));
  const tileCount = 2 ** zoom;
  const bounds = map.getBounds();

  const north = clamp(bounds.getNorth(), -85.051129, 85.051129);
  const south = clamp(bounds.getSouth(), -85.051129, 85.051129);
  let west = bounds.getWest();
  let east = bounds.getEast();

  if (east < west) {
    east += 360;
  }

  const minTileX = Math.floor(lngToTileX(west, zoom));
  const maxTileX = Math.floor(lngToTileX(east, zoom));
  const minTileY = clamp(Math.floor(latToTileY(north, zoom)), 0, tileCount - 1);
  const maxTileY = clamp(Math.floor(latToTileY(south, zoom)), 0, tileCount - 1);

  const totalTiles = (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
  const drawLabels = totalTiles <= MAX_TILE_LABELS;

  context.strokeStyle = "rgba(14, 165, 233, 0.9)";
  context.lineWidth = 1.2;
  context.font = "12px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    const wrappedTileX = modulo(tileX, tileCount);
    const westLng = tileXToLng(tileX, zoom);
    const eastLng = tileXToLng(tileX + 1, zoom);

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      const northLat = tileYToLat(tileY, zoom);
      const southLat = tileYToLat(tileY + 1, zoom);
      const corners: [
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
      ] = [
        map.project([westLng, northLat]),
        map.project([eastLng, northLat]),
        map.project([eastLng, southLat]),
        map.project([westLng, southLat]),
      ];

      context.beginPath();
      context.moveTo(corners[0].x, corners[0].y);
      context.lineTo(corners[1].x, corners[1].y);
      context.lineTo(corners[2].x, corners[2].y);
      context.lineTo(corners[3].x, corners[3].y);
      context.closePath();
      context.stroke();

      if (!drawLabels) {
        continue;
      }

      const centerX =
        (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
      const centerY =
        (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
      const label = `${zoom}/${wrappedTileX}/${tileY}`;

      const metrics = context.measureText(label);
      const textWidth = metrics.width;
      const textHeight = 16;
      const paddingX = 5;
      const paddingY = 2;

      context.fillStyle = "rgba(15, 23, 42, 0.72)";
      context.fillRect(
        centerX - textWidth / 2 - paddingX,
        centerY - textHeight / 2 - paddingY,
        textWidth + paddingX * 2,
        textHeight + paddingY * 2,
      );

      context.fillStyle = "rgba(241, 245, 249, 0.95)";
      context.fillText(label, centerX, centerY);
    }
  }
}

function syncCanvasSize(canvas: any, map: MapLibreMap): void {
  const target = map.getCanvas() as any;
  const width = target.width;
  const height = target.height;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 2 ** zoom;
}

function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  const tilesCount = 2 ** zoom;
  const projected = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return ((1 - projected / Math.PI) / 2) * tilesCount;
}

function tileXToLng(tileX: number, zoom: number): number {
  return (tileX / 2 ** zoom) * 360 - 180;
}

function tileYToLat(tileY: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * tileY) / 2 ** zoom;
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
