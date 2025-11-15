import { NextRequest, NextResponse } from "next/server";
import { getTsmAccessToken } from "@/lib/tsm";

interface RegionAverage {
  avg: number | null;
  sampleCount: number;
}

interface CachedEntry {
  hourKey: string; // YYYY-MM-DDTHH (UTC hour bucket)
  eu?: RegionAverage;
  na?: RegionAverage;
}

// In-memory cache: itemId -> data for the current hour
const priceCache = new Map<number, CachedEntry>();

function getCurrentHourKey(): string {
  const now = new Date();
  // Use UTC so the server is consistent. Still refreshes each top-of-hour.
  return now.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
}

// TSM region IDs: 1 = NA, 2 = EU (by TSM docs)
const REGION_ID_US = Number(process.env.TSM_REGION_ID_US || "1");
const REGION_ID_EU = Number(process.env.TSM_REGION_ID_EU || "2");

async function fetchTsmRegionItem(
  regionId: number,
  itemId: number
): Promise<RegionAverage> {
  const token = await getTsmAccessToken();

  const url = `https://pricing-api.tradeskillmaster.com/region/${regionId}/item/${itemId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    // Let Next cache raw TSM response briefly; separate from our hourly cache
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[TSM] pricing error", regionId, res.status, text);
    return { avg: null, sampleCount: 0 };
  }

  const data = (await res.json()) as any;

  // Handle different possible key casings / names
  const rawRegionSale =
    typeof data.regionSaleAvg === "number"
      ? data.regionSaleAvg
      : typeof data.RegionSaleAvg === "number"
      ? data.RegionSaleAvg
      : null;

  const rawMarket =
    typeof data.marketValue === "number"
      ? data.marketValue
      : typeof data.MarketValue === "number"
      ? data.MarketValue
      : typeof data.regionMarketValue === "number"
      ? data.regionMarketValue
      : typeof data.RegionMarketValue === "number"
      ? data.RegionMarketValue
      : typeof data.regionMarketAvg === "number"
      ? data.regionMarketAvg
      : typeof data.RegionMarketAvg === "number"
      ? data.RegionMarketAvg
      : null;

  const raw = rawRegionSale ?? rawMarket;

  if (raw == null || typeof raw !== "number" || raw <= 0) {
    console.warn("[TSM] No usable avg for item", {
      regionId,
      itemId,
      keys: Object.keys(data || {}),
    });
    return { avg: null, sampleCount: 0 };
  }

  // TSM prices are in COPPER → convert to GOLD
  const avgGold = Math.round(raw / 10000);

  return {
    avg: avgGold,
    sampleCount: 0, // region endpoint doesn't give us sample count
  };
}

// ⬇⬇⬇ THIS is the part 405 was complaining about – we MUST export GET ⬇⬇⬇
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemIdStr = searchParams.get("itemId");

    if (!itemIdStr) {
      return NextResponse.json(
        { error: "Missing itemId query parameter" },
        { status: 400 }
      );
    }

    const itemId = Number(itemIdStr);
    if (!itemId || Number.isNaN(itemId)) {
      return NextResponse.json(
        { error: "Invalid itemId query parameter" },
        { status: 400 }
      );
    }

    // Hour-bucket cache (so we only hit TSM once per item per hour)
    const hourKey = getCurrentHourKey();
    const cached = priceCache.get(itemId);

    if (cached && cached.hourKey === hourKey) {
      return NextResponse.json({
        itemId,
        eu: cached.eu ?? null,
        na: cached.na ?? null,
        cached: true,
        hourKey,
      });
    }

    // Fetch EU + NA region data from TSM in parallel
    const [euResult, usResult] = await Promise.all([
      fetchTsmRegionItem(REGION_ID_EU, itemId),
      fetchTsmRegionItem(REGION_ID_US, itemId),
    ]);

    const fresh: CachedEntry = {
      hourKey,
      eu: euResult,
      na: usResult,
    };
    priceCache.set(itemId, fresh);

    return NextResponse.json({
      itemId,
      eu: euResult,
      na: usResult,
      cached: false,
      hourKey,
    });
  } catch (err: any) {
    console.error("[item-prices] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch item prices",
        details: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
