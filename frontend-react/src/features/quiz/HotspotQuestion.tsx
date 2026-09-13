import { useEffect, useRef, useState } from "react";
import { getRuntimeConfig } from "../../runtime-config";
import type { QuizQuestion } from "../../api/quiz-api";
import type { QuizFeedback } from "./quiz-session";

interface Props {
  question: QuizQuestion;
  disabled: boolean;
  onComplete: (feedback: QuizFeedback) => void;
}

const svgCache = new Map<string, Promise<string>>();

export function HotspotQuestion({ question, disabled, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const disabledRef = useRef(disabled);
  const onCompleteRef = useRef(onComplete);
  const answeredRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  disabledRef.current = disabled;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const config = question.hotspot_config;
    const container = containerRef.current;
    answeredRef.current = false;
    setStatus("loading");
    if (!config || !container) return;

    let mounted = true;
    container.replaceChildren();

    loadHotspotSvg(config.source)
      .then((svgSource) => {
        if (!mounted) return;
        const diagram = createHotspotElement(question, svgSource, (selectedHotspotId, svgElement) => {
          if (disabledRef.current || answeredRef.current) return;
          answeredRef.current = true;
          const isCorrect = selectedHotspotId === config.target_hotspot_id;
          showHotspotStates(svgElement, selectedHotspotId, config.target_hotspot_id);
          lockHotspots(svgElement);
          onCompleteRef.current({
            isCorrect,
            explanation: question.explanation ?? "",
            earnedPoints: isCorrect ? 1 : 0,
            maximumPoints: 1,
          });
        });
        container.replaceChildren(diagram);
        setStatus("ready");
      })
      .catch(() => {
        if (mounted) setStatus("error");
      });

    return () => {
      mounted = false;
    };
  }, [question.id, question.hotspot_config?.source, question.hotspot_config?.target_hotspot_id]);

  if (!question.hotspot_config) {
    return <p className="hotspot-status">Brak konfiguracji diagramu.</p>;
  }

  return (
    <div className="hotspot-question-shell">
      {status === "loading" && <p className="hotspot-status">Ładowanie diagramu...</p>}
      {status === "error" && <p className="hotspot-status hotspot-status-error">Nie udało się załadować diagramu.</p>}
      <div ref={containerRef} className={status === "ready" ? "" : "hidden"} />
    </div>
  );
}

async function loadHotspotSvg(source: string): Promise<string> {
  if (!svgCache.has(source)) {
    const { API_BASE_URL } = getRuntimeConfig();
    svgCache.set(
      source,
      fetch(`${API_BASE_URL}${source}`).then((response) => {
        if (!response.ok) throw new Error(`Hotspot diagram request failed: ${response.status}`);
        return response.text();
      }),
    );
  }

  return svgCache.get(source)!;
}

function createHotspotElement(
  question: QuizQuestion,
  svgSource: string,
  onAnswer: (selectedHotspotId: string, svgElement: SVGSVGElement) => void,
) {
  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(svgSource, "image/svg+xml");
  const parserError = svgDocument.querySelector("parsererror");
  const sourceSvg = svgDocument.documentElement;

  if (parserError || sourceSvg.localName !== "svg") {
    throw new Error("Hotspot diagram is not valid SVG");
  }

  sanitizeHotspotSvg(sourceSvg);

  const svgElement = document.importNode(sourceSvg, true) as unknown as SVGSVGElement;
  const hotspotElements = Array.from(svgElement.querySelectorAll<SVGElement>("[data-hotspot-id]"));
  const targetHotspotId = question.hotspot_config?.target_hotspot_id;

  if (!targetHotspotId || !hotspotElements.some((element) => element.dataset.hotspotId === targetHotspotId)) {
    throw new Error(`Hotspot target not found: ${targetHotspotId}`);
  }

  svgElement.classList.add("hotspot-svg");
  svgElement.removeAttribute("width");
  svgElement.removeAttribute("height");
  svgElement.setAttribute("role", "group");
  svgElement.setAttribute("aria-label", "Interaktywny diagram do pytania");

  hotspotElements.forEach((hotspotElement) => {
    const hotspotId = hotspotElement.dataset.hotspotId ?? "";
    hotspotElement.classList.add("hotspot-region");
    hotspotElement.setAttribute("tabindex", "0");
    hotspotElement.setAttribute("focusable", "true");
    hotspotElement.setAttribute("role", "button");
    hotspotElement.setAttribute("aria-label", hotspotElement.dataset.hotspotLabel || "Wybierz obszar");
    hotspotElement.addEventListener("click", () => onAnswer(hotspotId, svgElement));
    hotspotElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onAnswer(hotspotId, svgElement);
      }
    });
  });

  const wrapper = document.createElement("div");
  wrapper.className = "hotspot-question";
  wrapper.appendChild(svgElement);
  return wrapper;
}

function sanitizeHotspotSvg(svgElement: Element) {
  Array.from(svgElement.querySelectorAll("script, foreignObject, style")).forEach((element) => {
    element.remove();
  });

  [svgElement, ...Array.from(svgElement.querySelectorAll("*"))].forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.localName.toLowerCase();
      const isExternalReference = name === "href" && Boolean(attribute.value) && !attribute.value.startsWith("#");

      if (name.startsWith("on") || name === "style" || isExternalReference) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function showHotspotStates(svgElement: SVGSVGElement, selectedHotspotId: string, targetHotspotId: string) {
  svgElement.querySelectorAll<SVGElement>("[data-hotspot-id]").forEach((hotspotElement) => {
    const hotspotId = hotspotElement.dataset.hotspotId;
    if (hotspotId === targetHotspotId) {
      hotspotElement.classList.add("correct", "revealed");
    } else if (hotspotId === selectedHotspotId) {
      hotspotElement.classList.add("incorrect", "revealed");
    }
  });
}

function lockHotspots(svgElement: SVGSVGElement) {
  svgElement.querySelectorAll<SVGElement>("[data-hotspot-id]").forEach((hotspotElement) => {
    hotspotElement.classList.add("locked");
    hotspotElement.setAttribute("tabindex", "-1");
    hotspotElement.setAttribute("aria-disabled", "true");
  });
}
