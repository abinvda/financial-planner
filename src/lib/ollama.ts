export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature: number;
}

/** Trim trailing slash so we can safely append paths. */
function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export interface OllamaTag {
  name: string;
}

/** Check connectivity and list available local models. */
export async function listModels(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${normalizeBase(baseUrl)}/api/tags`);
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  const data = (await res.json()) as { models?: OllamaTag[] };
  return (data.models ?? []).map((m) => m.name);
}

/**
 * Stream a chat completion from Ollama's /api/chat endpoint.
 * Calls `onToken` for each incremental chunk of assistant text.
 */
export async function streamChat(
  config: OllamaConfig,
  messages: ChatMessage[],
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${normalizeBase(config.baseUrl)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      options: { temperature: config.temperature },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama responded ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Ollama streams newline-delimited JSON objects.
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
        };
        if (obj.message?.content) onToken(obj.message.content);
      } catch {
        // Ignore partial/non-JSON lines.
      }
    }
  }
}
