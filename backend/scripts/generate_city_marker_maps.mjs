import {mkdir, readFile, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mapPath = path.join(projectRoot, "backend", "app", "static", "maps", "poland-voivodeships.geojson");
const outputDir = path.join(projectRoot, "backend", "app", "static", "images", "geography");

const cities = [
  {id: "warszawa", longitude: 21.0122, latitude: 52.2297},
  {id: "poznan", longitude: 16.9252, latitude: 52.4064},
  {id: "gdansk", longitude: 18.6466, latitude: 54.3520},
  {id: "olsztyn", longitude: 20.4801, latitude: 53.7784},
  {id: "krakow", longitude: 19.9450, latitude: 50.0647},
  {id: "lodz", longitude: 19.4550, latitude: 51.7592},
  {id: "wroclaw", longitude: 17.0385, latitude: 51.1079},
  {id: "katowice", longitude: 19.0238, latitude: 50.2649},
  {id: "szczecin", longitude: 14.5528, latitude: 53.4285},
];

function visitCoordinates(coordinates, visit) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    visit(coordinates);
    return;
  }

  coordinates.forEach((child) => visitCoordinates(child, visit));
}

function getGeoJsonBounds(geojson) {
  const bounds = {
    minLongitude: Infinity,
    maxLongitude: -Infinity,
    minLatitude: Infinity,
    maxLatitude: -Infinity,
  };

  (geojson.features || []).forEach((feature) => {
    visitCoordinates(feature.geometry?.coordinates, ([longitude, latitude]) => {
      bounds.minLongitude = Math.min(bounds.minLongitude, longitude);
      bounds.maxLongitude = Math.max(bounds.maxLongitude, longitude);
      bounds.minLatitude = Math.min(bounds.minLatitude, latitude);
      bounds.maxLatitude = Math.max(bounds.maxLatitude, latitude);
    });
  });

  const centerLatitude = (bounds.minLatitude + bounds.maxLatitude) / 2;
  const longitudeScale = Math.max(0.2, Math.cos((centerLatitude * Math.PI) / 180));

  return {
    ...bounds,
    longitudeScale,
    minProjectedLongitude: bounds.minLongitude * longitudeScale,
    maxProjectedLongitude: bounds.maxLongitude * longitudeScale,
  };
}

function getMapViewBox(bounds) {
  const longitudeSpan = Math.max(bounds.maxProjectedLongitude - bounds.minProjectedLongitude, 1);
  const latitudeSpan = Math.max(bounds.maxLatitude - bounds.minLatitude, 1);
  const width = 1000;
  const height = Math.max(320, Math.round(width * (latitudeSpan / longitudeSpan)));

  return {width, height, padding: 24};
}

function projectCoordinate(longitude, latitude, bounds, viewBox) {
  const mapWidth = Math.max(bounds.maxProjectedLongitude - bounds.minProjectedLongitude, 1);
  const mapHeight = Math.max(bounds.maxLatitude - bounds.minLatitude, 1);
  const padding = viewBox.padding;
  const drawableWidth = viewBox.width - padding * 2;
  const drawableHeight = viewBox.height - padding * 2;
  const projectedLongitude = longitude * bounds.longitudeScale;

  return {
    x: padding + ((projectedLongitude - bounds.minProjectedLongitude) / mapWidth) * drawableWidth,
    y: padding + ((bounds.maxLatitude - latitude) / mapHeight) * drawableHeight,
  };
}

function getLinePathData(coordinates, bounds, viewBox) {
  const points = coordinates.map(([longitude, latitude]) =>
    projectCoordinate(longitude, latitude, bounds, viewBox)
  );
  if (points.length === 0) {
    return "";
  }

  const [firstPoint, ...remainingPoints] = points;
  return [
    `M ${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)}`,
    ...remainingPoints.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
  ].join(" ");
}

function getPolygonPathData(polygon, bounds, viewBox) {
  return polygon
    .map((ring) => {
      const linePath = getLinePathData(ring, bounds, viewBox);
      return linePath ? `${linePath} Z` : "";
    })
    .filter(Boolean)
    .join(" ");
}

function getGeometryPathData(geometry, bounds, viewBox) {
  if (geometry.type === "Polygon") {
    return getPolygonPathData(geometry.coordinates, bounds, viewBox);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon) => getPolygonPathData(polygon, bounds, viewBox))
      .filter(Boolean)
      .join(" ");
  }

  return "";
}

function renderCitySvg(geojson, city, bounds, viewBox) {
  const paths = (geojson.features || [])
    .map((feature) => getGeometryPathData(feature.geometry, bounds, viewBox))
    .filter(Boolean)
    .map((pathData) => `<path d="${pathData}" fill="#e9edf1" stroke="#536b7c" stroke-width="1.4" vector-effect="non-scaling-stroke" fill-rule="evenodd"/>`)
    .join("\n    ");
  const point = projectCoordinate(city.longitude, city.latitude, bounds, viewBox);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox.width} ${viewBox.height}" role="img" aria-label="Mapa Polski z zaznaczonym miastem">
  <rect width="100%" height="100%" fill="#e6f4fa"/>
  <g>
    ${paths}
  </g>
  <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="24" fill="#d15b5b" stroke="#ffffff" stroke-width="8"/>
</svg>
`;
}

const geojson = JSON.parse(await readFile(mapPath, "utf8"));
const bounds = getGeoJsonBounds(geojson);
const viewBox = getMapViewBox(bounds);

await mkdir(outputDir, {recursive: true});

await Promise.all(cities.map((city) =>
  writeFile(
    path.join(outputDir, `poland-city-${city.id}.svg`),
    renderCitySvg(geojson, city, bounds, viewBox),
    "utf8"
  )
));
