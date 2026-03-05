import type {
  ControlPosition,
  IControl,
  Map as MapLibreMap,
} from "maplibre-gl";
import { useEffect } from "react";
import { useControl } from "react-map-gl/maplibre";

type TerrainToggleControlProps = {
  enabled: boolean;
  onToggle: () => void;
};

class TerrainToggleControlImpl implements IControl {
  private container: any;

  private button: any;

  constructor(
    private readonly onToggle: () => void,
    enabled: boolean,
  ) {
    const documentRef = (globalThis as unknown as { document: any }).document;

    this.container = documentRef.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    this.button = documentRef.createElement("button");
    this.button.type = "button";
    this.button.className = "maplibregl-ctrl-icon";
    this.button.style.width = "auto";
    this.button.style.padding = "0 8px";
    this.button.style.fontSize = "12px";
    this.button.style.lineHeight = "29px";
    this.button.setAttribute("aria-label", "Toggle terrain preview");
    this.button.addEventListener("click", () => this.onToggle());
    this.container.appendChild(this.button);

    this.setEnabled(enabled);
  }

  setEnabled(enabled: boolean): void {
    this.button.textContent = enabled ? "3D" : "2D";
    this.button.title = enabled
      ? "Switch to classic tiles preview"
      : "Switch to terrain preview";
  }

  onAdd(_map: MapLibreMap) {
    return this.container;
  }

  onRemove(): void {
    this.button.remove();
    this.container.remove();
  }

  getDefaultPosition(): ControlPosition {
    return "top-right";
  }
}

export function TerrainToggleControl({
  enabled,
  onToggle,
}: TerrainToggleControlProps) {
  const control = useControl<TerrainToggleControlImpl>(
    () => new TerrainToggleControlImpl(onToggle, enabled),
    { position: "top-right" },
  );

  useEffect(() => {
    control.setEnabled(enabled);
  }, [control, enabled]);

  return null;
}
