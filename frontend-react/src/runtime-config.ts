export interface RuntimeConfig {
  API_BASE_URL: string;
  LLM_API_BASE_URL: string;
}

declare global {
  interface Window {
    CONFIG?: RuntimeConfig;
  }
}

const defaultConfig: RuntimeConfig = {
  API_BASE_URL: "",
  LLM_API_BASE_URL: "/llm-api",
};

export function getRuntimeConfig(): RuntimeConfig {
  return {
    ...defaultConfig,
    ...window.CONFIG,
  };
}
