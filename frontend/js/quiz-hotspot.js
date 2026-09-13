// SECTION: quiz-hotspot-rendering
// Renders trusted local SVG diagrams with reusable clickable regions.
const hotspotSvgCache = new Map();

async function renderHotspotQuestion(question, answersEl) {
  answersEl.classList.remove("hidden");
  answersEl.replaceChildren(createHotspotStatusElement("Ładowanie diagramu..."));

  try {
    const svgSource = await loadHotspotSvg(question.hotspot_config.source);
    const diagramEl = createHotspotQuestionElement(question, svgSource);
    answersEl.replaceChildren(diagramEl);
  } catch (error) {
    console.error("Failed to load hotspot question SVG", error);
    answersEl.replaceChildren(createHotspotStatusElement("Nie udało się załadować diagramu."));
  }
}

async function loadHotspotSvg(source) {
  if (hotspotSvgCache.has(source)) {
    return hotspotSvgCache.get(source);
  }

  const response = await fetch(`${CONFIG.API_BASE_URL}${source}`);
  if (!response.ok) {
    throw new Error(`Hotspot diagram request failed: ${response.status}`);
  }

  const svgSource = await response.text();
  hotspotSvgCache.set(source, svgSource);
  return svgSource;
}

function createHotspotQuestionElement(question, svgSource) {
  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(svgSource, "image/svg+xml");
  const parserError = svgDocument.querySelector("parsererror");
  const sourceSvgEl = svgDocument.documentElement;

  if (parserError || sourceSvgEl.localName !== "svg") {
    throw new Error("Hotspot diagram is not valid SVG");
  }

  sanitizeHotspotSvg(sourceSvgEl);

  const svgEl = document.importNode(sourceSvgEl, true);
  const hotspotEls = [...svgEl.querySelectorAll("[data-hotspot-id]")];
  const targetHotspotId = question.hotspot_config.target_hotspot_id;

  if (!hotspotEls.some((element) => element.dataset.hotspotId === targetHotspotId)) {
    throw new Error(`Hotspot target not found: ${targetHotspotId}`);
  }

  svgEl.classList.add("hotspot-svg");
  svgEl.removeAttribute("width");
  svgEl.removeAttribute("height");
  svgEl.setAttribute("role", "group");
  svgEl.setAttribute("aria-label", "Interaktywna róża wiatrów");

  hotspotEls.forEach((hotspotEl) => {
    const hotspotId = hotspotEl.dataset.hotspotId;
    hotspotEl.classList.add("hotspot-region");
    hotspotEl.setAttribute("tabindex", "0");
    hotspotEl.setAttribute("focusable", "true");
    hotspotEl.setAttribute("role", "button");
    hotspotEl.setAttribute("aria-label", hotspotEl.dataset.hotspotLabel || "Wybierz obszar");
    hotspotEl.addEventListener("pointerenter", () => showHotspotPreview(hotspotEl));
    hotspotEl.addEventListener("pointerleave", () => clearHotspotPreview(hotspotEl));
    hotspotEl.addEventListener("focus", () => showHotspotPreview(hotspotEl));
    hotspotEl.addEventListener("blur", () => clearHotspotPreview(hotspotEl));
    hotspotEl.addEventListener("click", () => handleHotspotAnswer(hotspotId, svgEl));
    hotspotEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleHotspotAnswer(hotspotId, svgEl);
      }
    });
  });

  const wrapperEl = document.createElement("div");
  wrapperEl.className = "hotspot-question";
  wrapperEl.appendChild(svgEl);
  return wrapperEl;
}

function showHotspotPreview(hotspotEl) {
  if (hasAnswered) return;

  const pathEl = hotspotEl.querySelector("path");
  if (!pathEl) return;

  hotspotEl.classList.add("preview");
  pathEl.style.setProperty("fill", "#f8dc8a", "important");
  pathEl.style.setProperty("fill-opacity", "1", "important");
  pathEl.style.setProperty("stroke", "#8a601f", "important");
  pathEl.style.setProperty("stroke-width", "7", "important");
}

function clearHotspotPreview(hotspotEl) {
  const pathEl = hotspotEl.querySelector("path");
  if (!pathEl) return;

  hotspotEl.classList.remove("preview");
  pathEl.style.removeProperty("fill");
  pathEl.style.removeProperty("fill-opacity");
  pathEl.style.removeProperty("stroke");
  pathEl.style.removeProperty("stroke-width");
}

function clearAllHotspotPreviews(svgEl) {
  svgEl.querySelectorAll("[data-hotspot-id]").forEach((hotspotEl) => {
    clearHotspotPreview(hotspotEl);
  });
}

function sanitizeHotspotSvg(svgEl) {
  [...svgEl.querySelectorAll("script, foreignObject, style")].forEach((element) => {
    element.remove();
  });

  [svgEl, ...svgEl.querySelectorAll("*")].forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.localName.toLowerCase();
      const isExternalReference =
        name === "href" && attribute.value && !attribute.value.startsWith("#");

      if (name.startsWith("on") || name === "style" || isExternalReference) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function handleHotspotAnswer(selectedHotspotId, svgEl) {
  if (hasAnswered) return;

  hasAnswered = true;

  const question = getCurrentQuestion();
  const targetHotspotId = question.hotspot_config.target_hotspot_id;
  const isCorrect = selectedHotspotId === targetHotspotId;

  if (isCorrect) {
    earnedPoints += 1;
  }

  clearAllHotspotPreviews(svgEl);
  showHotspotStates(svgEl, selectedHotspotId, targetHotspotId);
  lockHotspots(svgEl);
  showFeedback(isCorrect, question.explanation);
}

function showHotspotStates(svgEl, selectedHotspotId, targetHotspotId) {
  svgEl.querySelectorAll("[data-hotspot-id]").forEach((hotspotEl) => {
    const hotspotId = hotspotEl.dataset.hotspotId;
    if (hotspotId === targetHotspotId) {
      hotspotEl.classList.add("correct", "revealed");
    } else if (hotspotId === selectedHotspotId) {
      hotspotEl.classList.add("incorrect", "revealed");
    }
  });
}

function lockHotspots(svgEl) {
  svgEl.querySelectorAll("[data-hotspot-id]").forEach((hotspotEl) => {
    hotspotEl.classList.add("locked");
    hotspotEl.setAttribute("tabindex", "-1");
    hotspotEl.setAttribute("aria-disabled", "true");
  });
}

function createHotspotStatusElement(message) {
  const statusEl = document.createElement("div");
  statusEl.className = "hotspot-status";
  statusEl.textContent = message;
  return statusEl;
}
