// Provider-agnostic LLM layer. Supports any OpenAI-compatible endpoint (Qwen via
// Alibaba DashScope, OpenRouter, etc.) and Anthropic. All analysis runs through here
// with a PhD-level statistician / quantitative-finance persona as the system prompt.

export type LLMProvider = "openai" | "anthropic";

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string; // OpenAI-compatible: e.g. https://dashscope-intl.aliyuncs.com/compatible-mode/v1
  model: string; // e.g. qwen3-max, qwen-max, qwen/qwen3-max (OpenRouter), claude-haiku-4-5-20251001
  apiKey: string;
}

export const ANALYST_PERSONA =
  "You are a PhD-level statistician and quantitative finance expert. " +
  "Reason with rigor: use base rates and probabilistic thinking, quantify uncertainty, " +
  "distinguish correlation from causation, and flag small-sample, survivorship, or " +
  "overfitting risks. State assumptions explicitly and prefer ranges over false precision. " +
  "Be evidence-based and intellectually honest — never fabricate numbers, dates, or facts; " +
  "if data is missing, say so. When the user asks for JSON, output ONLY valid JSON with no prose.";

export const QWEN_PRESET: LLMConfig = {
  provider: "openai",
  baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  model: "qwen3-max",
  apiKey: "",
};

export const CLAUDE_PRESET: LLMConfig = {
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  model: "claude-haiku-4-5-20251001",
  apiKey: "",
};

export const DEFAULT_LLM: LLMConfig = { ...QWEN_PRESET };

export function llmReady(c: LLMConfig | undefined | null): boolean {
  return !!(c && c.apiKey && c.baseUrl && c.model);
}

// Single completion. Returns the raw text content; callers parse JSON via parseJSONLoose.
export async function llmComplete(
  cfg: LLMConfig,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  if (cfg.provider === "anthropic") return anthropicComplete(cfg, userPrompt, maxTokens);
  return openAICompatibleComplete(cfg, userPrompt, maxTokens);
}

async function openAICompatibleComplete(
  cfg: LLMConfig,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: ANALYST_PERSONA },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`LLM ${cfg.model}: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function anthropicComplete(
  cfg: LLMConfig,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const base = (cfg.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "");
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      system: ANALYST_PERSONA,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude ${cfg.model}: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// Tolerant JSON parse: strips code fences, falls back to first {...} block, returns {} on failure.
export function parseJSONLoose<T = any>(text: string): T {
  const s = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1)) as T;
    } catch {
      /* fall through */
    }
  }
  return {} as T;
}

// ---- Centralized app config (LLM + data keys) with migration from the old shape ----

export type NewsSource = "polygon" | "apify";

export interface AppConfig {
  mmd: string;
  apify: string;
  llm: LLMConfig;
  newsSource: NewsSource; // "polygon" = free (default), "apify" = paid, richer
}

export function loadAppConfig(): AppConfig {
  try {
    const raw = JSON.parse(localStorage.getItem("das:config") || "{}");
    let llm: LLMConfig | undefined = raw.llm;
    if (!llm) {
      // Migrate old {mmd, apify, claude} → Anthropic LLM config, else Qwen default.
      llm = raw.claude
        ? { ...CLAUDE_PRESET, apiKey: raw.claude }
        : { ...DEFAULT_LLM };
    }
    return {
      mmd: raw.mmd ?? "",
      apify: raw.apify ?? "",
      llm,
      newsSource: raw.newsSource === "apify" ? "apify" : "polygon",
    };
  } catch {
    return { mmd: "", apify: "", llm: { ...DEFAULT_LLM }, newsSource: "polygon" };
  }
}

export function saveAppConfig(c: AppConfig): void {
  try {
    localStorage.setItem("das:config", JSON.stringify(c));
  } catch {
    /* quota */
  }
}
