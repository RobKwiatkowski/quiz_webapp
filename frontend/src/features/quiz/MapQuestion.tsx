import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { getRuntimeConfig } from "../../runtime-config";
import type { Answer, QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

interface Props {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}

interface GeoJsonFeature {
  id?: string | number | null;
  geometry?: Geometry | null;
  properties?: Record<string, unknown> | null;
}

interface GeoJsonData {
  features?: GeoJsonFeature[];
}

interface Geometry {
  type: "Polygon" | "MultiPolygon" | "LineString" | "MultiLineString";
  coordinates: unknown;
}

interface Bounds {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
  longitudeScale: number;
  minProjectedLongitude: number;
  maxProjectedLongitude: number;
}

interface ViewBox {
  width: number;
  height: number;
  padding: number;
}

const geoJsonCache = new Map<string, Promise<GeoJsonData>>();
const LINE_SELECTION_TOLERANCE_PX = 15;
const LINE_AMBIGUITY_DELTA_PX = 2;

export function MapQuestion({ question, disabled, onComplete }: Props) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; geojson: GeoJsonData; backgroundGeojson: GeoJsonData | null }
  >({ status: "loading" });
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectionHint, setSelectionHint] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const config = question.map_config;
  const interaction = config?.interaction ?? "region";
  const answerChoices = useMemo(
    () => shuffle(question.answers.map((answer, originalIndex) => ({ answer, originalIndex }))),
    [question.id, question.answers],
  );

  useEffect(() => {
    if (!config) return;
    let mounted = true;
    setState({ status: "loading" });
    setSelectedFeatureId(null);
    setSelectionHint("");

    Promise.all([
      loadMapGeoJson(config.source),
      config.background_source ? loadMapGeoJson(config.background_source) : Promise.resolve(null),
    ])
      .then(([geojson, backgroundGeojson]) => {
        if (mounted) setState({ status: "ready", geojson, backgroundGeojson });
      })
      .catch(() => {
        if (mounted) setState({ status: "error" });
      });

    return () => {
      mounted = false;
    };
  }, [config?.source, config?.background_source, question.id]);

  if (!config) {
    return <p className="map-status">Brak konfiguracji mapy.</p>;
  }

  if (state.status === "loading") {
    return <p className="map-status">Ładowanie mapy...</p>;
  }

  if (state.status === "error") {
    return <p className="map-status map-status-error">Nie udało się załadować mapy.</p>;
  }

  const bounds = getGeoJsonBounds(state.geojson);
  const viewBox = getMapViewBox(bounds);
  const targetFeature = state.geojson.features?.find((feature) => getFeatureId(feature) === config.target_feature_id);

  const selectFeature = (featureId: string) => {
    if (disabled || selectedFeatureId) return;
    const isCorrect = featureId === config.target_feature_id;
    setSelectedFeatureId(featureId);
    setSelectionHint("");
    onComplete(createFeedback(isCorrect, question));
  };

  const selectNearestLine = (event: PointerEvent<SVGSVGElement>) => {
    if (interaction !== "line" || config.mode !== "select" || disabled || selectedFeatureId) return;

    const svg = svgRef.current;
    if (!svg) return;

    const svgPoint = toSvgPoint(svg, event.clientX, event.clientY);
    if (!svgPoint) return;

    const tolerance = screenPixelsToSvgUnits(svg, event.clientX, event.clientY, LINE_SELECTION_TOLERANCE_PX);
    const ambiguityDelta = screenPixelsToSvgUnits(svg, event.clientX, event.clientY, LINE_AMBIGUITY_DELTA_PX);
    const nearestLines = getNearestLineFeatures(state.geojson, bounds, viewBox, svgPoint);
    const nearest = nearestLines[0];

    if (!nearest || nearest.distance > tolerance) {
      setSelectionHint("");
      return;
    }

    const secondNearest = nearestLines[1];
    if (secondNearest && secondNearest.distance - nearest.distance < ambiguityDelta) {
      event.preventDefault();
      setSelectionHint("Kliknij trochę dalej od przecięcia linii.");
      return;
    }

    event.preventDefault();
    selectFeature(nearest.featureId);
  };

  const selectIdentifyAnswer = (answer: Answer) => {
    if (disabled || selectedFeatureId) return;
    setSelectedFeatureId(answer.text);
    onComplete(createFeedback(answer.is_correct, question));
  };

  return (
    <div className={`map-question map-question-${config.mode}`}>
      <div className="map-frame">
        <svg
          ref={svgRef}
          className="map-svg"
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
          role="group"
          aria-label="Interaktywna mapa do pytania"
          onPointerDown={selectNearestLine}
        >
          <g className="map-content">
            {state.backgroundGeojson?.features?.map((feature, index) => (
              <MapLayerPath
                key={`background-${index}`}
                feature={feature}
                bounds={bounds}
                viewBox={viewBox}
                className={getBackgroundClassName(feature)}
              />
            ))}
            {state.geojson.features?.map((feature, index) => {
              const featureId = getFeatureId(feature);
              if (!featureId) return null;
              const isLineInteractionFeature = interaction === "line" && isAnswerLineFeature(feature);
              const isSelectableRegion = interaction === "region" && config.mode === "select";
              const isTarget = featureId === config.target_feature_id;
              const isSelected = featureId === selectedFeatureId;
              const resultClass = selectedFeatureId
                ? isTarget ? "correct" : isSelected ? "incorrect" : "locked"
                : "";
              const className = isLineInteractionFeature
                ? `map-line ${resultClass}`
                : `${interaction === "line" ? getBackgroundClassName(feature) : "map-region"} ${config.mode === "identify" && isTarget ? "target" : ""} ${resultClass}`;

              return (
                <MapLayerPath
                  key={featureId || index}
                  feature={feature}
                  bounds={bounds}
                  viewBox={viewBox}
                  className={className}
                  role={isSelectableRegion || isLineInteractionFeature ? "button" : undefined}
                  tabIndex={(isSelectableRegion || isLineInteractionFeature) && !disabled && !selectedFeatureId ? 0 : -1}
                  ariaLabel={isLineInteractionFeature ? getNeutralLineLabel(state.geojson, featureId) : isSelectableRegion ? "Wybierz region" : undefined}
                  onActivate={isSelectableRegion || isLineInteractionFeature ? () => selectFeature(featureId) : undefined}
                  activateOnClick={!isLineInteractionFeature}
                />
              );
            })}
          </g>
        </svg>
      </div>
      {selectionHint && <p className="map-selection-hint">{selectionHint}</p>}
      {interaction === "line" && selectedFeatureId && targetFeature && (
        <p className="map-selection-result">Poprawna linia: {getFeatureName(targetFeature)}.</p>
      )}
      {config.background_source && <MapCaption source={config.source} />}
      {config.mode === "identify" && (
        <div className="answer-list map-identify-answers">
          {answerChoices.map(({ answer, originalIndex }) => {
            const isSelected = selectedFeatureId === answer.text;
            const resultClass = selectedFeatureId
              ? answer.is_correct ? "answer-correct" : isSelected ? "answer-incorrect" : ""
              : "";

            return (
              <button
                key={`${question.id}-${originalIndex}`}
                className={`answer-button ${resultClass}`}
                disabled={disabled || Boolean(selectedFeatureId)}
                type="button"
                onClick={() => selectIdentifyAnswer(answer)}
              >
                {answer.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MapLayerPath({
  feature,
  bounds,
  viewBox,
  className,
  role,
  tabIndex,
  ariaLabel,
  onActivate,
  activateOnClick = true,
}: {
  feature: GeoJsonFeature;
  bounds: Bounds;
  viewBox: ViewBox;
  className: string;
  role?: string;
  tabIndex?: number;
  ariaLabel?: string;
  onActivate?: () => void;
  activateOnClick?: boolean;
}) {
  const pathData = feature.geometry ? getGeometryPathData(feature.geometry, bounds, viewBox) : "";
  if (!pathData) return null;

  return (
    <path
      className={className.trim()}
      d={pathData}
      fillRule="evenodd"
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      onClick={activateOnClick ? onActivate : undefined}
      onKeyDown={(event) => {
        if (!onActivate) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
    />
  );
}

async function loadMapGeoJson(source: string): Promise<GeoJsonData> {
  if (!geoJsonCache.has(source)) {
    const { API_BASE_URL } = getRuntimeConfig();
    geoJsonCache.set(
      source,
      fetch(`${API_BASE_URL}${source}`).then((response) => {
        if (!response.ok) throw new Error(`Map request failed: ${response.status}`);
        return response.json() as Promise<GeoJsonData>;
      }),
    );
  }

  return geoJsonCache.get(source)!;
}

function getFeatureId(feature: GeoJsonFeature): string {
  if (typeof feature.id === "string") return feature.id;
  if (typeof feature.id === "number") return String(feature.id);
  const id = feature.properties?.id;
  return typeof id === "string" ? id : "";
}

function getFeatureName(feature: GeoJsonFeature): string {
  const namePl = feature.properties?.name_pl;
  if (typeof namePl === "string" && namePl.trim()) return namePl;

  const name = feature.properties?.name;
  if (typeof name === "string" && name.trim()) return name;

  return getFeatureId(feature);
}

function isAnswerLineFeature(feature: GeoJsonFeature): boolean {
  return feature.properties?.role === "answer_line";
}

function getNeutralLineLabel(geojson: GeoJsonData, featureId: string): string {
  const lineIndex = geojson.features
    ?.filter(isAnswerLineFeature)
    .findIndex((feature) => getFeatureId(feature) === featureId);

  return `Wybierz linię ${lineIndex !== undefined && lineIndex >= 0 ? lineIndex + 1 : ""}`.trim();
}

function getBackgroundClassName(feature: GeoJsonFeature): string {
  return feature.properties?.role === "river" ? "map-basemap-river" : "map-basemap-land";
}

function getGeometryPathData(geometry: Geometry, bounds: Bounds, viewBox: ViewBox): string {
  if (geometry.type === "Polygon") {
    return getPolygonPathData(geometry.coordinates, bounds, viewBox);
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .map((polygon) => getPolygonPathData(polygon, bounds, viewBox))
      .filter(Boolean)
      .join(" ");
  }

  if (geometry.type === "LineString") {
    return getLinePathData(geometry.coordinates, bounds, viewBox);
  }

  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .map((line) => getLinePathData(line, bounds, viewBox))
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

function getPolygonPathData(polygon: unknown, bounds: Bounds, viewBox: ViewBox): string {
  if (!Array.isArray(polygon)) return "";

  return polygon
    .map((ring) => getLinePathData(ring, bounds, viewBox))
    .filter(Boolean)
    .map((linePath) => `${linePath} Z`)
    .join(" ");
}

function getLinePathData(coordinates: unknown, bounds: Bounds, viewBox: ViewBox): string {
  if (!Array.isArray(coordinates)) return "";

  const points = coordinates
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || typeof coordinate[0] !== "number" || typeof coordinate[1] !== "number") {
        return null;
      }
      return projectCoordinate(coordinate[0], coordinate[1], bounds, viewBox);
    })
    .filter((point): point is { x: number; y: number } => Boolean(point));

  if (points.length === 0) return "";

  const [firstPoint, ...remainingPoints] = points;
  return [
    `M ${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)}`,
    ...remainingPoints.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
  ].join(" ");
}

function projectCoordinate(longitude: number, latitude: number, bounds: Bounds, viewBox: ViewBox) {
  const mapWidth = Math.max(bounds.maxProjectedLongitude - bounds.minProjectedLongitude, 1);
  const mapHeight = Math.max(bounds.maxLatitude - bounds.minLatitude, 1);
  const drawableWidth = viewBox.width - viewBox.padding * 2;
  const drawableHeight = viewBox.height - viewBox.padding * 2;
  const projectedLongitude = longitude * bounds.longitudeScale;

  return {
    x: viewBox.padding + ((projectedLongitude - bounds.minProjectedLongitude) / mapWidth) * drawableWidth,
    y: viewBox.padding + ((bounds.maxLatitude - latitude) / mapHeight) * drawableHeight,
  };
}

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());

  return { x: transformed.x, y: transformed.y };
}

function screenPixelsToSvgUnits(svg: SVGSVGElement, clientX: number, clientY: number, pixels: number): number {
  const point = toSvgPoint(svg, clientX, clientY);
  const shiftedPoint = toSvgPoint(svg, clientX + pixels, clientY);

  if (!point || !shiftedPoint) return pixels;

  return Math.hypot(shiftedPoint.x - point.x, shiftedPoint.y - point.y);
}

function getNearestLineFeatures(
  geojson: GeoJsonData,
  bounds: Bounds,
  viewBox: ViewBox,
  point: { x: number; y: number },
): Array<{ featureId: string; distance: number }> {
  return (geojson.features ?? [])
    .filter(isAnswerLineFeature)
    .map((feature) => {
      const featureId = getFeatureId(feature);
      const linePoints = feature.geometry ? getGeometryLinePoints(feature.geometry, bounds, viewBox) : [];
      const distance = getDistanceToLineStrings(point, linePoints);
      return { featureId, distance };
    })
    .filter((candidate) => candidate.featureId && Number.isFinite(candidate.distance))
    .sort((left, right) => left.distance - right.distance);
}

function getGeometryLinePoints(
  geometry: Geometry,
  bounds: Bounds,
  viewBox: ViewBox,
): Array<Array<{ x: number; y: number }>> {
  if (geometry.type === "LineString") {
    return [getProjectedLinePoints(geometry.coordinates, bounds, viewBox)].filter((line) => line.length > 1);
  }

  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .map((line) => getProjectedLinePoints(line, bounds, viewBox))
      .filter((line) => line.length > 1);
  }

  return [];
}

function getProjectedLinePoints(coordinates: unknown, bounds: Bounds, viewBox: ViewBox): Array<{ x: number; y: number }> {
  if (!Array.isArray(coordinates)) return [];

  return coordinates
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || typeof coordinate[0] !== "number" || typeof coordinate[1] !== "number") {
        return null;
      }
      return projectCoordinate(coordinate[0], coordinate[1], bounds, viewBox);
    })
    .filter((projectedPoint): projectedPoint is { x: number; y: number } => Boolean(projectedPoint));
}

function getDistanceToLineStrings(
  point: { x: number; y: number },
  lineStrings: Array<Array<{ x: number; y: number }>>,
): number {
  return Math.min(
    ...lineStrings.flatMap((line) => line.slice(0, -1).map((linePoint, index) => getDistanceToSegment(point, linePoint, line[index + 1]))),
  );
}

function getDistanceToSegment(
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
): number {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);

  const t = Math.max(0, Math.min(1, ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared));
  const projectionX = segmentStart.x + t * dx;
  const projectionY = segmentStart.y + t * dy;

  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function getGeoJsonBounds(geojson: GeoJsonData): Bounds {
  const bounds = {
    minLongitude: Infinity,
    maxLongitude: -Infinity,
    minLatitude: Infinity,
    maxLatitude: -Infinity,
  };

  geojson.features?.forEach((feature) => {
    visitCoordinates(feature.geometry?.coordinates, ([longitude, latitude]) => {
      bounds.minLongitude = Math.min(bounds.minLongitude, longitude);
      bounds.maxLongitude = Math.max(bounds.maxLongitude, longitude);
      bounds.minLatitude = Math.min(bounds.minLatitude, latitude);
      bounds.maxLatitude = Math.max(bounds.maxLatitude, latitude);
    });
  });

  if (!Number.isFinite(bounds.minLongitude) || !Number.isFinite(bounds.minLatitude)) {
    return {
      minLongitude: 0,
      maxLongitude: 1,
      minLatitude: 0,
      maxLatitude: 1,
      longitudeScale: 1,
      minProjectedLongitude: 0,
      maxProjectedLongitude: 1,
    };
  }

  const centerLatitude = (bounds.minLatitude + bounds.maxLatitude) / 2;
  const longitudeScale = Math.max(0.2, Math.cos((centerLatitude * Math.PI) / 180));

  return {
    ...bounds,
    longitudeScale,
    minProjectedLongitude: bounds.minLongitude * longitudeScale,
    maxProjectedLongitude: bounds.maxLongitude * longitudeScale,
  };
}

function visitCoordinates(coordinates: unknown, visit: (coordinate: [number, number]) => void) {
  if (!Array.isArray(coordinates)) return;

  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    visit([coordinates[0], coordinates[1]]);
    return;
  }

  coordinates.forEach((child) => visitCoordinates(child, visit));
}

function getMapViewBox(bounds: Bounds): ViewBox {
  const longitudeSpan = Math.max(bounds.maxProjectedLongitude - bounds.minProjectedLongitude, 1);
  const latitudeSpan = Math.max(bounds.maxLatitude - bounds.minLatitude, 1);
  const width = 1000;
  const height = Math.max(320, Math.round(width * (latitudeSpan / longitudeSpan)));

  return { width, height, padding: 24 };
}

function MapCaption({ source }: { source: string }) {
  if (source === "/static/maps/world-oceans.geojson") {
    return (
      <p className="map-caption">
        Kontynenty są pokazane jako tło orientacyjne.
        <br />
        Podkład: Natural Earth.
      </p>
    );
  }

  return (
    <p className="map-caption">
      Przybliżone regiony starożytnych cywilizacji. Granice zmieniały się w czasie.
      <br />
      Podkład: Natural Earth.
    </p>
  );
}

function createFeedback(isCorrect: boolean, question: QuizQuestion): QuizFeedback {
  return {
    isCorrect,
    explanation: question.explanation ?? "",
    earnedPoints: isCorrect ? 1 : 0,
    maximumPoints: 1,
  };
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
