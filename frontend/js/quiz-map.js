// SECTION: quiz-map-rendering
// Lightweight GeoJSON-to-SVG renderer for map-based questions.
const geoJsonCache = new Map();

async function renderMapQuestion(question, answersEl) {
  answersEl.classList.remove("hidden");
  answersEl.replaceChildren(createMapStatusElement("Ładowanie mapy..."));

  try {
    const [geojson, backgroundGeojson] = await Promise.all([
      loadMapGeoJson(question.map_config.source),
      question.map_config.background_source
        ? loadMapGeoJson(question.map_config.background_source)
        : Promise.resolve(null),
    ]);
    const mapEl = createMapQuestionElement(question, geojson, backgroundGeojson);

    answersEl.replaceChildren(mapEl);

    if (question.map_config.mode === "identify") {
      renderMapIdentifyAnswers(question, answersEl);
    }
  } catch (error) {
    console.error("Failed to load map question GeoJSON", error);
    answersEl.replaceChildren(createMapStatusElement("Nie udało się załadować mapy."));
  }
}

async function loadMapGeoJson(source) {
  if (geoJsonCache.has(source)) {
    return geoJsonCache.get(source);
  }

  const response = await fetch(`${CONFIG.API_BASE_URL}${source}`);
  if (!response.ok) {
    throw new Error(`Map request failed: ${response.status}`);
  }

  const geojson = await response.json();
  geoJsonCache.set(source, geojson);
  return geojson;
}

function createMapQuestionElement(question, geojson, backgroundGeojson) {
  const wrapperEl = document.createElement("div");
  wrapperEl.className = `map-question map-question-${question.map_config.mode}`;

  const mapFrameEl = document.createElement("div");
  mapFrameEl.className = "map-frame";
  const svgEl = renderGeoJsonMap(geojson, question, backgroundGeojson);
  mapFrameEl.appendChild(svgEl);
  wrapperEl.appendChild(mapFrameEl);

  if (question.map_config.background_source) {
    wrapperEl.appendChild(createMapCaption());
  }

  return wrapperEl;
}

function renderGeoJsonMap(geojson, question, backgroundGeojson) {
  const bounds = getGeoJsonBounds(geojson);
  const viewBox = getMapViewBox(bounds);
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const contentEl = document.createElementNS("http://www.w3.org/2000/svg", "g");

  svgEl.classList.add("map-svg");
  svgEl.setAttribute("viewBox", `0 0 ${viewBox.width} ${viewBox.height}`);
  svgEl.setAttribute("role", "group");
  svgEl.setAttribute("aria-label", "Interaktywna mapa do pytania");
  svgEl.setAttribute("tabindex", "0");
  contentEl.classList.add("map-content");

  if (backgroundGeojson) {
    renderMapBackground(backgroundGeojson, contentEl, bounds, viewBox);
  }

  (geojson.features || []).forEach((feature) => {
    const pathEl = createFeaturePath(feature, bounds, viewBox, question);
    if (pathEl) {
      contentEl.appendChild(pathEl);
    }
  });

  svgEl.appendChild(contentEl);
  return svgEl;
}

function renderMapBackground(geojson, parentEl, bounds, viewBox) {
  (geojson.features || []).forEach((feature) => {
    const role = feature?.properties?.role;
    const className = role === "river" ? "map-basemap-river" : "map-basemap-land";
    const pathEl = createMapLayerPath(feature, bounds, viewBox, className);
    if (pathEl) {
      parentEl.appendChild(pathEl);
    }
  });
}

function createFeaturePath(feature, bounds, viewBox, question) {
  const featureId = feature?.properties?.id;
  if (!featureId || !feature.geometry) {
    return null;
  }

  const pathEl = createMapLayerPath(feature, bounds, viewBox, "map-region");
  if (!pathEl) {
    return null;
  }

  pathEl.dataset.featureId = featureId;
  pathEl.setAttribute("tabindex", "0");
  pathEl.setAttribute("focusable", "true");
  pathEl.setAttribute("role", "button");
  pathEl.setAttribute("aria-label", "Wybierz region");

  if (question.map_config.target_feature_id === featureId && question.map_config.mode === "identify") {
    pathEl.classList.add("target");
  }

  if (question.map_config.mode === "select") {
    pathEl.addEventListener("click", () => {
      handleMapSelectAnswer(featureId);
    });
    pathEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleMapSelectAnswer(featureId);
      }
    });
  }

  return pathEl;
}

function createMapLayerPath(feature, bounds, viewBox, className) {
  if (!feature?.geometry) {
    return null;
  }

  const pathData = getGeometryPathData(feature.geometry, bounds, viewBox);
  if (!pathData) {
    return null;
  }

  const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEl.classList.add(className);
  pathEl.setAttribute("d", pathData);
  pathEl.setAttribute("fill-rule", "evenodd");
  return pathEl;
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

  if (geometry.type === "LineString") {
    return getLinePathData(geometry.coordinates, bounds, viewBox);
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates
      .map((line) => getLinePathData(line, bounds, viewBox))
      .filter(Boolean)
      .join(" ");
  }

  return "";
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

function getMapViewBox(bounds) {
  const longitudeSpan = Math.max(bounds.maxProjectedLongitude - bounds.minProjectedLongitude, 1);
  const latitudeSpan = Math.max(bounds.maxLatitude - bounds.minLatitude, 1);
  const width = 1000;
  const height = Math.max(320, Math.round(width * (latitudeSpan / longitudeSpan)));

  return {width, height, padding: 24};
}

function createMapCaption() {
  const captionEl = document.createElement("p");
  captionEl.className = "map-caption";
  captionEl.append(
    document.createTextNode("Przybliżone regiony starożytnych cywilizacji. Granice zmieniały się w czasie."),
    document.createElement("br"),
    document.createTextNode("Podkład: Natural Earth.")
  );
  return captionEl;
}

function renderMapIdentifyAnswers(question, answersEl) {
  const shuffledAnswers = shuffleArray(question.answers || []);

  shuffledAnswers.forEach((answer) => {
    const button = document.createElement("button");
    button.className = "answer-btn";
    button.dataset.correct = String(answer.is_correct);
    button.type = "button";
    button.textContent = answer.text;
    button.addEventListener("click", handleSingleAnswerClick);
    answersEl.appendChild(button);
  });
}

function handleMapSelectAnswer(selectedFeatureId) {
  if (hasAnswered) return;

  hasAnswered = true;

  const question = getCurrentQuestion();
  const targetFeatureId = question.map_config.target_feature_id;
  const isCorrect = selectedFeatureId === targetFeatureId;

  if (isCorrect) {
    earnedPoints += 1;
  }

  showMapRegionStates(selectedFeatureId, targetFeatureId);
  lockMapRegions();
  showFeedback(isCorrect, question.explanation);
}

function showMapRegionStates(selectedFeatureId, targetFeatureId) {
  document.querySelectorAll(".map-region").forEach((regionEl) => {
    if (regionEl.dataset.featureId === targetFeatureId) {
      regionEl.classList.add("correct");
    } else if (regionEl.dataset.featureId === selectedFeatureId) {
      regionEl.classList.add("incorrect");
    }
  });
}

function lockMapRegions() {
  document.querySelectorAll(".map-region").forEach((regionEl) => {
    regionEl.classList.add("locked");
    regionEl.setAttribute("tabindex", "-1");
  });
}

function createMapStatusElement(message) {
  const statusEl = document.createElement("div");
  statusEl.className = "map-status";
  statusEl.textContent = message;
  return statusEl;
}
