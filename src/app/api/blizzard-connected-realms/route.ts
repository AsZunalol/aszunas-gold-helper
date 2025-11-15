import { NextRequest, NextResponse } from "next/server";
import { getBlizzardAccessToken } from "@/lib/blizzard";

const DYNAMIC_EU =
  process.env.BLIZZARD_NAMESPACE_DYNAMIC_EU || "dynamic-eu";
const DYNAMIC_US =
  process.env.BLIZZARD_NAMESPACE_DYNAMIC_US || "dynamic-us";

const LOCALE_EU = process.env.BLIZZARD_LOCALE_EU || "en_GB";
const LOCALE_US = process.env.BLIZZARD_LOCALE_US || "en_US";

async function fetchConnectedRealms(params: {
  regionHost: "eu" | "us";
  namespace: string;
  locale: string;
  token: string;
}) {
  const { regionHost, namespace, locale, token } = params;

  const url = new URL(
    `https://${regionHost}.api.blizzard.com/data/wow/connected-realm/index`
  );
  url.searchParams.set("namespace", namespace);
  url.searchParams.set("locale", locale);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    console.error(
      `[Blizzard API] connected-realm/index failed for ${regionHost}:`,
      res.status,
      text
    );
    throw new Error(`Failed to fetch connected realms for ${regionHost}`);
  }

  const json = (await res.json()) as any;
  // Shape: { connected_realms: [{ href: "…/connected-realm/1305" }, …] }
  const refs: any[] = json?.connected_realms || [];

  // Now fetch each connected realm detail to get its realms / names
  const results: any[] = [];

  for (const ref of refs) {
    const href: string | undefined = ref?.href;
    if (!href) continue;

    const detailUrl = new URL(href);
    // Add token / locale / namespace in case href doesn't have them
    detailUrl.searchParams.set("namespace", namespace);
    detailUrl.searchParams.set("locale", locale);
    detailUrl.searchParams.set("access_token", token);

    const dRes = await fetch(detailUrl.toString());
    if (!dRes.ok) {
      console.warn(
        `[Blizzard API] connected-realm detail failed:`,
        dRes.status
      );
      continue;
    }

    const dJson = (await dRes.json()) as any;
    const id: number | undefined = dJson?.id;

    const realms = (dJson?.realms || []).map((r: any) => ({
      id: r?.id,
      slug: r?.slug,
      name: r?.name?.en_US || r?.name?.en_GB || r?.name,
    }));

    results.push({
      connectedRealmId: id,
      realms,
    });
  }

  return results;
}

export async function GET(_req: NextRequest) {
  try {
    const token = await getBlizzardAccessToken();

    const [eu, us] = await Promise.all([
      fetchConnectedRealms({
        regionHost: "eu",
        namespace: DYNAMIC_EU,
        locale: LOCALE_EU,
        token,
      }),
      fetchConnectedRealms({
        regionHost: "us",
        namespace: DYNAMIC_US,
        locale: LOCALE_US,
        token,
      }),
    ]);

    return NextResponse.json({ eu, us });
  } catch (err: any) {
    console.error("[blizzard-connected-realms] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch connected realms" },
      { status: 500 }
    );
  }
}
