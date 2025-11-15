"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

/* ---------- Types ---------- */

interface GuideRow {
  id: number;
  title: string;
  slug: string | null;
  expansion: string | null;
  zone: string | null;
  gold_per_hour: number | null;
  difficulty: string | null;
  method_type: string | null;
  recommended_level: string | null;
  faction: string | null;
  is_featured: boolean | null;
  is_premium: boolean | null;
  last_tested_patch: string | null;
  content_html: string | null;
  thumbnail_urls: string[] | null;
}

interface GuideItemRow {
  id: number;
  guide_id: number;
  item_id: number;
  label: string;
  note: string | null;
}

interface RegionAverage {
  avg: number | null;
  sampleCount: number;
}

interface ItemPricesResponse {
  itemId: number;
  eu?: RegionAverage | null;
  na?: RegionAverage | null;
  cached?: boolean;
  hourKey?: string;
  // Optional icon from backend (icon name or full URL)
  icon?: string | null;
}

type PriceStatus =
  | { state: "loading" }
  | { state: "error"; message?: string }
  | {
      state: "ready";
      euAvg: number | null;
      naAvg: number | null;
      euSamples: number;
      naSamples: number;
      iconUrl?: string | null;
    };

type PriceMap = Record<number, PriceStatus>;

interface AghUser {
  membershipType?: string;
  username?: string;
  email?: string;
}

function hasPremiumMembership(user: AghUser | null): boolean {
  if (!user?.membershipType) return false;
  const v = user.membershipType.toLowerCase();
  // Treat explicit "premium"-like memberships as having access
  if (v === "premium" || v === "lifetime" || v === "founder") return true;
  // Everything else (including "free") is non-premium
  return false;
}

/* ---------- Helpers ---------- */

// Here, avg is already in GOLD in your API, so we keep this simple
function formatGold(amountInGold: number | null): string {
  if (amountInGold == null) return "No auction data";
  return `${amountInGold.toLocaleString()}g`;
}

/* ---------- Page ---------- */

export default function GuidePage() {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean).pop() || "";

  const [guide, setGuide] = useState<GuideRow | null>(null);
  const [items, setItems] = useState<GuideItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AghUser | null>(null);

  useEffect(() => {
    if (!slug) return;

    const loadGuide = async () => {
      setLoading(true);
      setError(null);

      try {
        const isNumeric = /^\d+$/.test(slug);

        let query = supabase
          .from("guides")
          .select(
            `
            id,
            title,
            slug,
            expansion,
            zone,
            gold_per_hour,
            difficulty,
            method_type,
            recommended_level,
            faction,
            is_featured,
            is_premium,
            last_tested_patch,
            content_html,
            thumbnail_urls
          `
          )
          .limit(1);

        if (isNumeric) {
          query = query.eq("id", Number(slug));
        } else {
          query = query.eq("slug", slug);
        }

        const { data: guides, error: guideError } = await query;

        if (guideError) {
          console.error("Supabase guide fetch error:", guideError);
          setError("Guide not found");
          setGuide(null);
          setLoading(false);
          return;
        }

        if (!guides || guides.length === 0) {
          setError("Guide not found");
          setGuide(null);
          setLoading(false);
          return;
        }

        const g = guides[0] as GuideRow;
        setGuide(g);

        const { data: itemsData, error: itemsError } = await supabase
          .from("guide_items")
          .select("id, guide_id, item_id, label, note")
          .eq("guide_id", g.id)
          .order("id", { ascending: true });

        if (itemsError) {
          console.error("Supabase guide_items fetch error:", itemsError);
          setItems([]);
        } else {
          setItems((itemsData || []) as GuideItemRow[]);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Unexpected error loading guide:", err);
        setError("Failed to load guide");
        setLoading(false);
      }
    };

    loadGuide();
  }, [slug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("agh_user");
      if (raw) {
        const parsed = JSON.parse(raw) as AghUser;
        setUser(parsed);
      }
    } catch (err) {
      console.error("Guide page: failed to load user from localStorage", err);
    }
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 pt-24">
        <p className="text-sm text-slate-400">Summoning goblin scribes…</p>
      </main>
    );
  }

  if (error || !guide) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 pt-24">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-emerald-400">
            Guide not found
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            The goblins couldn&apos;t find this guide. It might be unpublished
            or the URL is wrong.
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
          >
            ⬅ Back to AsZUna&apos;s Gold Helper
          </a>
        </div>
      </main>
    );
  }

  const {
    title,
    content_html,
    expansion,
    zone,
    faction,
    difficulty,
    method_type,
    is_premium,
    gold_per_hour,
    recommended_level,
    last_tested_patch,
    thumbnail_urls,
  } = guide;

  const isPremiumGuide = !!is_premium;
  const userHasPremium = hasPremiumMembership(user);
  const isPremiumLocked = isPremiumGuide && !userHasPremium;

  const firstThumb = thumbnail_urls?.[0] ?? null;

  const premiumLabel = is_premium ? "PREMIUM" : "FREE";
  const premiumColor = is_premium
    ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100"
    : "border-emerald-400/70 bg-emerald-500/15 text-emerald-100";

  const goldPerHourNumber =
    typeof gold_per_hour === "number" && !isNaN(gold_per_hour)
      ? gold_per_hour
      : null;

  const difficultyLabel = difficulty || "";
  const difficultyColor =
    difficultyLabel === "Easy"
      ? "border-emerald-400/50 text-emerald-200 bg-emerald-500/10"
      : difficultyLabel === "Medium"
      ? "border-sky-400/50 text-sky-200 bg-sky-500/10"
      : difficultyLabel
      ? "border-rose-400/60 text-rose-200 bg-rose-500/15"
      : "border-slate-600/60 text-slate-200 bg-slate-800/40";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 pt-24 pb-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* HERO */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/90">
          <div className="relative">
            {firstThumb ? (
              <div className="relative h-40 sm:h-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={firstThumb}
                  alt={title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
              </div>
            ) : (
              <div className="h-32 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-950" />
            )}

            <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-5 pointer-events-none">
              <div className="flex justify-between items-start">
  <div className="flex items-center gap-2">
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold shadow-lg ${premiumColor}`}
    >
      {premiumLabel}
    </span>

    {isPremiumLocked && (
      <span className="inline-flex items-center rounded-full border border-amber-400/70 bg-slate-950/90 px-2.5 py-1 text-[10px] font-semibold text-amber-200 shadow-lg">
        🔒 Premium
      </span>
    )}
  </div>

  {goldPerHourNumber && goldPerHourNumber > 0 && (
    <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-slate-950/90 px-3 py-1 text-[10px] font-semibold text-amber-300 shadow-lg">
      {goldPerHourNumber.toLocaleString()} GP/H
    </span>
  )}
</div>

              <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-emerald-400 drop-shadow">
                    {title}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] sm:text-[11px]">
                    {expansion && (
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-slate-200">
                        {expansion}
                      </span>
                    )}
                    {zone && (
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-slate-200">
                        {zone}
                      </span>
                    )}
                    {faction && (
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-slate-200">
                        {faction}
                      </span>
                    )}
                    {method_type && (
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-slate-200">
                        {method_type}
                      </span>
                    )}
                    {recommended_level && (
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-slate-200">
                        Rec. level: {recommended_level}
                      </span>
                    )}
                  </div>
                </div>

                {difficultyLabel && (
                  <span
                    className={`self-start sm:self-auto inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold shadow-lg ${difficultyColor}`}
                  >
                    {difficultyLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* MAIN CONTENT + SIDEBAR */}
        <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
          {/* Guide body */}
          <article className="rounded-2xl border border-slate-800 bg-slate-950/90 p-5">
            {isPremiumLocked ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
                <h2 className="text-lg font-semibold text-emerald-400">
                  Premium guide
                </h2>
                <p className="mt-2 text-[13px] text-slate-300">
                  This guide is available for Premium members only.
                </p>
                {user ? (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Your current membership is{" "}
                    <span className="font-semibold text-emerald-300">
                      {user.membershipType || "free"}
                    </span>
                    . Upgrade your membership to unlock the full strategy,
                    route details and item breakdown.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Log in or create an account to see if you have Premium
                    access. Premium members unlock the full guide, including
                    exact routes, tips and item breakdowns.
                  </p>
                )}
                <a
                  href="/"
                  className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
                >
                  Go to homepage
                </a>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none prose-headings:text-emerald-300 prose-a:text-emerald-400 prose-strong:text-emerald-200 prose-li:marker:text-emerald-400 prose-img:rounded-lg">
                {/* eslint-disable-next-line react/no-danger */}
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      content_html && content_html.trim().length > 0
                        ? content_html
                        : "<p class='text-slate-500 text-sm'>This guide doesn&apos;t have any content yet.</p>",
                  }}
                />
              </div>
            )}
          </article>

          {/* Sidebar with prices */}
          <SidebarItems
            items={items}
            lastTestedPatch={last_tested_patch}
            isLocked={isPremiumLocked}
          />
        </section>
      </div>
    </main>
  );
}

/* ---------- Sidebar: Items of Note + prices ---------- */

function SidebarItems({
  items,
  lastTestedPatch,
  isLocked,
}: {
  items: GuideItemRow[];
  lastTestedPatch: string | null;
  isLocked: boolean;
}) {
  const [prices, setPrices] = useState<PriceMap>({});

  const fallbackIcon =
    "https://wow.zamimg.com/images/wow/icons/medium/inv_misc_questionmark.jpg";
  const goldCoinIcon = "https://wow.zamimg.com/images/icons/money-gold.gif";

  useEffect(() => {
    if (isLocked || !items || items.length === 0) {
      setPrices({});
      return;
    }

    // Unique itemIds for this guide
    const uniqueIds = Array.from(
      new Set(items.map((i) => i.item_id).filter((id) => !!id))
    );
    if (uniqueIds.length === 0) {
      setPrices({});
      return;
    }

    let cancelled = false;

    const load = async () => {
      // Mark all as loading
      setPrices(() => {
        const initial: PriceMap = {};
        for (const id of uniqueIds) {
          initial[id] = { state: "loading" };
        }
        return initial;
      });

      await Promise.all(
        uniqueIds.map(async (itemId) => {
          try {
            const res = await fetch(`/api/item-prices?itemId=${itemId}`);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const json: ItemPricesResponse = await res.json();

            const eu = json.eu ?? null;
            const na = json.na ?? null;

            const euAvg = eu?.avg ?? null;
            const naAvg = na?.avg ?? null;
            const euSamples = eu?.sampleCount ?? 0;
            const naSamples = na?.sampleCount ?? 0;

            // Optional icon from backend
            const iconField = (json as any).icon ?? null;
            let iconUrl: string | null = null;
            if (iconField && typeof iconField === "string") {
              iconUrl = iconField.startsWith("http")
                ? iconField
                : `https://wow.zamimg.com/images/wow/icons/medium/${iconField}.jpg`;
            }

            if (cancelled) return;

            setPrices((prev) => ({
              ...prev,
              [itemId]: {
                state: "ready",
                euAvg,
                naAvg,
                euSamples,
                naSamples,
                iconUrl,
              },
            }));
          } catch (err) {
            console.error("Failed to load price for item", itemId, err);
            if (cancelled) return;
            setPrices((prev) => ({
              ...prev,
              [itemId]: { state: "error", message: "Price unavailable" },
            }));
          }
        })
      );
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [items, isLocked]);

  if (isLocked) {
    return (
      <aside className="space-y-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Items of Note
          </h2>
          <p className="mt-2 text-[11px] text-slate-500">
            Item breakdown and live prices are part of this premium guide.
            Upgrade your membership to unlock this section.
          </p>
        </div>
        {lastTestedPatch && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span>Last tested patch</span>
              <span className="font-semibold text-emerald-300">
                {lastTestedPatch}
              </span>
            </div>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="space-y-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Items of Note
          </h2>
          {items.length > 0 && (
            <span className="text-[9px] text-slate-500">
              Data from TradeSkillMaster (region)
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-500">
            No items of note have been added for this guide yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((item) => {
              const price = prices[item.item_id];

              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-2"
                >
                  <div className="flex gap-2">
                    <div className="mt-0.5 h-8 w-8 flex-shrink-0 overflow-hidden rounded border border-slate-700 bg-slate-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          price &&
                          price.state === "ready" &&
                          price.iconUrl
                            ? price.iconUrl
                            : fallbackIcon
                        }
                        alt={item.label || `Item ${item.item_id}`}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-100">
                          {item.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          #{item.item_id}
                        </span>
                      </div>

                      {item.note && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {item.note}
                        </p>
                      )}

                      {/* Prices */}
                      <div className="mt-1 text-[10px] text-slate-400">
                        {!price || price.state === "loading" ? (
                          <p>Fetching latest prices…</p>
                        ) : price.state === "error" ? (
                          <p>
                            {price.message || "Price unavailable right now."}
                          </p>
                        ) : (
                          <>
                            <p className="text-slate-300">Average price:</p>

                            {/* EU PRICE */}
                            <p className="mt-0.5 flex items-center gap-1">
                              <span className="font-bold text-slate-100">
                                EU:{" "}
                                {price.euAvg == null
                                  ? "No auction data"
                                  : formatGold(price.euAvg)}
                              </span>
                              {price.euAvg != null && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={goldCoinIcon}
                                  alt="gold"
                                  className="inline-block h-4 w-4"
                                />
                              )}
                            </p>

                            {/* NA PRICE */}
                            <p className="flex items-center gap-1">
                              <span className="font-bold text-slate-100">
                                NA:{" "}
                                {price.naAvg == null
                                  ? "No auction data"
                                  : formatGold(price.naAvg)}
                              </span>
                              {price.naAvg != null && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={goldCoinIcon}
                                  alt="gold"
                                  className="inline-block h-4 w-4"
                                />
                              )}
                            </p>

                            <p className="mt-0.5 text-[9px] text-slate-500">
                              Average prices cached hourly from
                              TradeSkillMaster&apos;s region data.
                            </p>
                          </>
                        )}
                      </div>

                      <p className="mt-1 text-[10px] text-slate-500">
                        View on{" "}
                        <a
                          href={`https://www.wowhead.com/item=${item.item_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          Wowhead
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {lastTestedPatch && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-3 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span>Last tested patch</span>
            <span className="font-semibold text-emerald-300">
              {lastTestedPatch}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
