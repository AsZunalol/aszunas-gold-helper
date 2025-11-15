// src/lib/blizzard.ts
const BLIZZ_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID!;
const BLIZZ_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET!;

if (!BLIZZ_CLIENT_ID || !BLIZZ_CLIENT_SECRET) {
  // This will show up in server logs if env is missing
  console.warn(
    "[Blizzard API] Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET in env."
  );
}

type BlizzardTokenCache = {
  token: string | null;
  expiresAt: number; // unix timestamp in seconds
};

const tokenCache: BlizzardTokenCache = {
  token: null,
  expiresAt: 0,
};

/**
 * Get an app-level OAuth access token for Blizzard APIs using
 * the client credentials flow against https://oauth.battle.net/token
 */
export async function getBlizzardAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // If we have a non-expired token, reuse it
  if (tokenCache.token && tokenCache.expiresAt > now + 60) {
    return tokenCache.token;
  }

  const basicAuth = Buffer.from(
    `${BLIZZ_CLIENT_ID}:${BLIZZ_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    // client_credentials flow: no user, just app token
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Blizzard API] Token request failed:", res.status, text);
    throw new Error("Failed to fetch Blizzard access token");
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number; // ~ 24h
    token_type: string;
  };

  tokenCache.token = json.access_token;
  tokenCache.expiresAt = now + (json.expires_in || 0);

  return json.access_token;
}
