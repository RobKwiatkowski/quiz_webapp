import { useEffect, useRef, useState } from "react";
import { getRuntimeConfig } from "../../runtime-config";
import type { QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";
import "./leaflet-map-question.css";

type Coordinates = [number, number];
type Bounds = [Coordinates, Coordinates];
type Style = { color?: string; weight?: number; fillColor?: string; fillOpacity?: number; radius?: number };
type Feature = { id?: string; geometry?: { type: string }; properties?: { name?: string } };
interface Layer {
  addTo: (map: LeafletMap) => Layer;
  bindTooltip: (label: HTMLElement, options: { permanent: boolean; direction: string; offset: Coordinates }) => Layer;
  getElement: () => SVGElement | undefined;
  setStyle: (style: Style) => Layer;
}
interface LeafletMap {
  fitBounds: (bounds: Bounds, options: { padding: Coordinates }) => void;
  remove: () => void;
}
interface Leaflet {
  map: (container: HTMLElement, options: object) => LeafletMap;
  circleMarker: (position: Coordinates, style: Style) => Layer;
  geoJSON: (data: unknown, options: {
    style: Style;
    interactive?: boolean;
    attribution?: string;
    pointToLayer?: (feature: Feature, position: Coordinates) => Layer;
    onEachFeature?: (feature: Feature, layer: Layer) => void;
  }) => Layer;
}

const assetRoot = "/vendor/leaflet/";
const usStatesSource = "/static/maps/us-contiguous-states.geojson";
const views: Readonly<Partial<Record<string, Bounds>>> = {
  "/static/maps/italian-unification-islands.geojson": [[35.8, 6.5], [45.2, 19.3]],
  "/static/maps/german-unification-cities.geojson": [[46.2, 7.4], [54, 16.5]],
  [usStatesSource]: [[24.4, -125], [49.5, -66]],
  "/static/maps/us-civil-war-battles.geojson": [[30, -94], [43, -67]],
  "/static/maps/colonialism-suez.geojson": [[16, 17], [39, 51]],
  "/static/maps/colonialism-east-asia.geojson": [[20, 103], [51, 151]],
};
let leafletPromise: Promise<Leaflet> | undefined;

export function usesLeafletMap(question: QuizQuestion): boolean {
  const config = question.map_config;
  return config?.mode === "select" && Object.hasOwn(views, config.source);
}

function loadLeaflet(): Promise<Leaflet> {
  leafletPromise ??= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = assetRoot + "leaflet.css";
    const script = document.createElement("script");
    script.src = assetRoot + "leaflet.js";
    const cssReady = new Promise<void>((loaded, failed) => {
      css.onload = () => loaded();
      css.onerror = failed;
    });
    const scriptReady = new Promise<void>((loaded, failed) => {
      script.onload = () => loaded();
      script.onerror = failed;
    });
    Promise.all([cssReady, scriptReady]).then(() => {
      const leaflet = (window as Window & { L?: Leaflet }).L;
      if (!leaflet) throw new Error("Leaflet failed to initialize");
      resolve(leaflet);
    }).catch((error: unknown) => {
      css.remove();
      script.remove();
      leafletPromise = undefined;
      reject(error);
    });
    document.head.append(css, script);
  });
  return leafletPromise;
}

async function fetchGeoJson(source: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(getRuntimeConfig().API_BASE_URL + source, { signal });
  if (!response.ok) throw new Error("GeoJSON request failed");
  return response.json();
}

export function LeafletMapQuestion({ question, disabled, onComplete }: {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const current = useRef({ disabled, onComplete });
  current.current = { disabled, onComplete };
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const config = question.map_config;
  const explanation = question.explanation ?? "";

  useEffect(() => {
    const element = container.current;
    const bounds = config && views[config.source];
    if (!element || !config || !bounds) return;

    const controller = new AbortController();
    const { signal } = controller;
    let map: LeafletMap | undefined;
    let answered = false;
    setStatus("loading");
    Promise.all([
      loadLeaflet(),
      fetchGeoJson(config.source, signal),
      config.background_source ? fetchGeoJson(config.background_source, signal) : null,
    ]).then(([leaflet, targets, background]) => {
      if (signal.aborted) return;
      const instance = leaflet.map(element, { zoomSnap: 0.25, scrollWheelZoom: false });
      map = instance;
      instance.fitBounds(bounds, { padding: [10, 10] });
      if (background) {
        leaflet.geoJSON(background, {
          interactive: false,
          attribution: config.background_source === usStatesSource ? "U.S. Census Bureau" : "Natural Earth",
          style: { color: "#84989b", weight: 1, fillColor: "#edf1e8", fillOpacity: 1 },
        }).addTo(instance);
      }

      const style = { color: "#285c73", weight: 2, fillColor: "#72b8cc", fillOpacity: 0.75 };
      const choices: Array<{ feature: Feature; layer: Layer; label: string }> = [];
      leaflet.geoJSON(targets, {
        style,
        attribution: config.source === usStatesSource ? "U.S. Census Bureau"
          : config.source.startsWith("/static/maps/colonialism-") ? "Natural Earth" : undefined,
        pointToLayer: (_feature, position) => leaflet.circleMarker(position, { ...style, radius: 10 }),
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name;
          if (name && feature.geometry?.type === "Point") {
            const label = document.createElement("span");
            label.textContent = name;
            layer.bindTooltip(label, { permanent: true, direction: "right", offset: [9, 0] });
          }
          choices.push({ feature, layer, label: name ?? `Obszar ${choices.length + 1}` });
        },
      }).addTo(instance);

      for (const { feature, layer, label } of choices) {
        const path = layer.getElement();
        if (!path) continue;
        path.setAttribute("tabindex", "0");
        path.setAttribute("role", "button");
        path.setAttribute("aria-label", label);
        const select = () => {
          if (answered || current.current.disabled) return;
          answered = true;
          const isCorrect = feature.id === config.target_feature_id;
          for (const choice of choices) {
            const choicePath = choice.layer.getElement();
            choicePath?.setAttribute("aria-disabled", "true");
            choicePath?.setAttribute("tabindex", "-1");
            if (choice.feature.id === config.target_feature_id) {
              choice.layer.setStyle({ fillColor: "#3a9968", fillOpacity: 1 });
            }
          }
          if (!isCorrect) layer.setStyle({ fillColor: "#d98061", fillOpacity: 1 });
          current.current.onComplete({ isCorrect, explanation, earnedPoints: isCorrect ? 1 : 0, maximumPoints: 1 });
        };
        path.addEventListener("click", select);
        path.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            select();
          }
        });
      }
      setStatus("ready");
    }).catch(() => {
      if (signal.aborted) return;
      map?.remove();
      map = undefined;
      setStatus("error");
    });

    return () => {
      controller.abort();
      map?.remove();
    };
  }, [config, explanation]);

  return (
    <div className="leaflet-quiz">
      {status === "loading" && <p role="status">Ładowanie mapy…</p>}
      {status === "error" && <p role="alert">Nie udało się załadować mapy.</p>}
      <div ref={container} className="leaflet-quiz-map" aria-label="Interaktywna mapa do pytania" />
    </div>
  );
}
