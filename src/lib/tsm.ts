// src/lib/tsm.ts

const TSM_CLIENT_ID = "c260f00d-1071-409a-992f-dda2e5498536"; // from TSM docs
const TSM_API_KEY = process.env.TSM_API_KEY;

if (!TSM_API_KEY) {
  console.warn("[TSM] TSM_API_KEY is not set. Pricing API will not work.");
}

type CachedToken = {
  token: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

export async function getTsmAccessToken(): Promise<string> {
  if (!TSM_API_KEY) {
    throw new Error("TSM_API_KEY is missing");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch("https://auth.tradeskillmaster.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: TSM_CLIENT_ID,
      grant_type: "api_token",
      scope: "app:realm-api app:pricing-api",
      token: TSM_API_KEY,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[TSM] auth error", res.status, text);
    throw new Error("Failed to get TSM access token");
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const ttlMs = (json.expires_in ?? 3600) * 1000;
  cachedToken = {
    token: json.access_token,
    expiresAt: now + ttlMs,
  };

  return json.access_token;
}
