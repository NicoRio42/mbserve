import "maplibre-gl/dist/maplibre-gl.css";
import { use, useMemo } from "react";
import { Map, NavigationControl } from "react-map-gl/maplibre";
import { buildStyleFromConfig, configPromise } from "./config.ts";

const fallbackCenter: [number, number] = [0, 0];

export default function App() {
  const config = use(configPromise);
  const mapStyle = useMemo(() => {
    return buildStyleFromConfig(config);
  }, [config]);

  return (
    <Map
      initialViewState={{
        longitude: config.center?.[0] ?? fallbackCenter[0],
        latitude: config.center?.[1] ?? fallbackCenter[1],
        zoom: config.zoom ?? 2,
        bearing: config.encoding ? -20 : 0,
        pitch: config.encoding ? 60 : 0,
      }}
      mapStyle={mapStyle}
      hash
      maxPitch={85}
      maxBounds={config.bounds}
    >
      <NavigationControl />
    </Map>
  );
}
