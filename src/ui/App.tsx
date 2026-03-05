import "maplibre-gl/dist/maplibre-gl.css";
import { use, useEffect, useMemo, useState } from "react";
import { Map, NavigationControl } from "react-map-gl/maplibre";
import { buildStyleFromConfig, configPromise } from "./config.ts";
import { TerrainToggleControl } from "./terrain-control.ts";

const fallbackCenter: [number, number] = [0, 0];

export default function App() {
  const config = use(configPromise);
  const supportsTerrainPreview = Boolean(config.encoding);
  const [terrainPreviewEnabled, setTerrainPreviewEnabled] = useState(
    supportsTerrainPreview,
  );

  useEffect(() => {
    setTerrainPreviewEnabled(supportsTerrainPreview);
  }, [supportsTerrainPreview]);

  const mapStyle = useMemo(() => {
    return buildStyleFromConfig(config, {
      terrainPreview: terrainPreviewEnabled,
    });
  }, [config, terrainPreviewEnabled]);

  return (
    <Map
      initialViewState={{
        longitude: config.center?.[0] ?? fallbackCenter[0],
        latitude: config.center?.[1] ?? fallbackCenter[1],
        zoom: config.zoom ?? 2,
        bearing: terrainPreviewEnabled ? -20 : 0,
        pitch: terrainPreviewEnabled ? 60 : 0,
      }}
      mapStyle={mapStyle}
      hash
      maxPitch={85}
      maxBounds={config.bounds}
    >
      <NavigationControl />
      {supportsTerrainPreview ? (
        <TerrainToggleControl
          enabled={terrainPreviewEnabled}
          onToggle={() => {
            setTerrainPreviewEnabled((enabled) => !enabled);
          }}
        />
      ) : null}
    </Map>
  );
}
