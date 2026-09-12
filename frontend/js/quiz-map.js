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
  const {svgEl, controlsEl} = renderGeoJsonMap(geojson, question, backgroundGeojson);
  mapFrameEl.append(svgEl, controlsEl);
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

  const interaction = createMapInteraction(svgEl, contentEl, viewBox);

  if (backgroundGeojson) {
    renderMapBackground(backgroundGeojson, contentEl, bounds, viewBox);
  }

  (geojson.features || []).forEach((feature) => {
    const pathEl = createFeaturePath(feature, bounds, viewBox, question, interaction);
    if (pathEl) {
      contentEl.appendChild(pathEl);
    }
  });

  svgEl.appendChild(contentEl);
  return {svgEl, controlsEl: createMapControls(interaction)};
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

function createFeaturePath(feature, bounds, viewBox, question, interaction) {
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
      if (!interaction.shouldSuppressSelection()) {
        handleMapSelectAnswer(featureId);
      }
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

function createMapInteraction(svgEl, contentEl, viewBox) {
  const state = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    pointers: new Map(),
    dragStart: null,
    dragOrigin: null,
    pinchDistance: null,
    pinchScale: 1,
    didMove: false,
    suppressSelection: false,
  };

  const clampScale = (scale) => Math.min(10, Math.max(1, scale));
  const applyTransform = () => {
    contentEl.setAttribute(
      "transform",
      `translate(${state.translateX.toFixed(2)} ${state.translateY.toFixed(2)}) scale(${state.scale.toFixed(3)})`
    );
  };
  const getSvgPoint = (event) => {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * viewBox.width,
      y: ((event.clientY - rect.top) / rect.height) * viewBox.height,
    };
  };
  const getPointerDistance = () => {
    const [first, second] = [...state.pointers.values()];
    return Math.hypot(second.x - first.x, second.y - first.y);
  };
  const zoomBy = (factor) => {
    state.scale = clampScale(state.scale * factor);
    applyTransform();
  };
  const reset = () => {
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;
    applyTransform();
  };

  svgEl.addEventListener("pointerdown", (event) => {
    svgEl.focus({preventScroll: true});
    state.pointers.set(event.pointerId, getSvgPoint(event));
    svgEl.setPointerCapture(event.pointerId);
    state.didMove = false;

    if (state.pointers.size === 1) {
      state.dragStart = getSvgPoint(event);
      state.dragOrigin = {x: state.translateX, y: state.translateY};
    } else if (state.pointers.size === 2) {
      state.pinchDistance = getPointerDistance();
      state.pinchScale = state.scale;
    }
  });

  svgEl.addEventListener("pointermove", (event) => {
    if (!state.pointers.has(event.pointerId)) {
      return;
    }

    const point = getSvgPoint(event);
    state.pointers.set(event.pointerId, point);

    if (state.pointers.size === 2 && state.pinchDistance) {
      state.scale = clampScale(state.pinchScale * (getPointerDistance() / state.pinchDistance));
      state.didMove = true;
      svgEl.classList.add("is-dragging");
      applyTransform();
      return;
    }

    if (state.pointers.size === 1 && state.dragStart && state.dragOrigin) {
      const deltaX = point.x - state.dragStart.x;
      const deltaY = point.y - state.dragStart.y;
      if (Math.hypot(deltaX, deltaY) > 4) {
        state.didMove = true;
        svgEl.classList.add("is-dragging");
      }
      if (state.didMove) {
        state.translateX = state.dragOrigin.x + deltaX;
        state.translateY = state.dragOrigin.y + deltaY;
        applyTransform();
      }
    }
  });

  const finishPointerInteraction = (event) => {
    if (!state.pointers.has(event.pointerId)) {
      return;
    }
    state.pointers.delete(event.pointerId);
    if (state.didMove) {
      state.suppressSelection = true;
      window.setTimeout(() => {
        state.suppressSelection = false;
      }, 0);
    }
    if (state.pointers.size < 2) {
      state.pinchDistance = null;
    }
    if (state.pointers.size === 0) {
      state.dragStart = null;
      state.dragOrigin = null;
      svgEl.classList.remove("is-dragging");
    }
  };

  svgEl.addEventListener("pointerup", finishPointerInteraction);
  svgEl.addEventListener("pointercancel", finishPointerInteraction);
  svgEl.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.18 : 1 / 1.18);
  }, {passive: false});
  svgEl.addEventListener("keydown", (event) => {
    if (event.target !== svgEl) {
      return;
    }

    const panStep = 36;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(1.25);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomBy(1 / 1.25);
    } else if (event.key === "0") {
      event.preventDefault();
      reset();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      state.translateX += panStep;
      applyTransform();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      state.translateX -= panStep;
      applyTransform();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.translateY += panStep;
      applyTransform();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      state.translateY -= panStep;
      applyTransform();
    }
  });

  applyTransform();
  return {zoomBy, reset, shouldSuppressSelection: () => state.suppressSelection};
}

function createMapControls(interaction) {
  const controlsEl = document.createElement("div");
  controlsEl.className = "map-controls";
  controlsEl.setAttribute("aria-label", "Sterowanie mapą");

  controlsEl.append(
    createMapControlButton("+", "Przybliż", () => interaction.zoomBy(1.25)),
    createMapControlButton("−", "Oddal", () => interaction.zoomBy(1 / 1.25)),
    createMapControlButton("↺", "Przywróć początkowy widok", interaction.reset)
  );
  return controlsEl;
}

function createMapControlButton(label, ariaLabel, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "map-control-btn";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.setAttribute("title", ariaLabel);
  button.addEventListener("click", action);
  return button;
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
