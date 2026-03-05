import type {
  ControlPosition,
  IControl,
  Map as MapLibreMap,
} from "maplibre-gl";
import { useEffect } from "react";
import { useControl } from "react-map-gl/maplibre";

type GridPreviewControlProps = {
  enabled: boolean;
  onToggle: () => void;
};

class GridPreviewControlImpl implements IControl {
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
    this.button.setAttribute("aria-label", "Toggle tiles grid preview");
    this.button.addEventListener("click", () => this.onToggle());
    this.container.appendChild(this.button);

    this.setEnabled(enabled);
  }

  setEnabled(enabled: boolean): void {
    this.button.textContent = enabled ? "Grid: On" : "Grid: Off";
    this.button.title = enabled
      ? "Hide slippy map tiles grid"
      : "Show slippy map tiles grid";
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

export function GridPreviewControl({
  enabled,
  onToggle,
}: GridPreviewControlProps) {
  const control = useControl<GridPreviewControlImpl>(
    () => new GridPreviewControlImpl(onToggle, enabled),
    { position: "top-right" },
  );

  useEffect(() => {
    control.setEnabled(enabled);
  }, [control, enabled]);

  return null;
}
