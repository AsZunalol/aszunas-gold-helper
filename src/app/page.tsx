"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ---------- Types ----------
interface GuideRow {
  id: number;
  title: string;
  slug: string | null;
  expansion: string | null;
  zone: string | null;
  gold_per_hour: number | null;
  difficulty: string | null;
  method_type: string | null;
  faction: string | null;
  is_featured: boolean | null;
  is_premium: boolean | null;
  thumbnail_urls: string[] | null;
}

export default function Home() {
  const [featuredGuides, setFeaturedGuides] = useState<GuideRow[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);

  useEffect(() => {
    const loadFeaturedGuides = async () => {
      setLoadingFeatured(true);
      setFeaturedError(null);

      const { data, error } = await supabase
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
          faction,
          is_featured,
          is_premium,
          thumbnail_urls
        `
        )
        .eq("is_featured", true)
        .order("id", { ascending: false })
        .limit(6);

      if (error) {
        console.error("Error loading featured guides:", error);
        setFeaturedError(error.message || "Failed to load featured guides.");
        setFeaturedGuides([]);
      } else {
        setFeaturedGuides((data || []) as GuideRow[]);
      }

      setLoadingFeatured(false);
    };

    loadFeaturedGuides();
  }, []);

  return (
    <main
      className="
        relative flex min-h-screen flex-col items-center
        overflow-hidden text-center text-slate-100
        bg-[url('/bg.jpg')] bg-cover bg-center bg-fixed bg-no-repeat
      "
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" />

      {/* HERO */}
      <section className="relative z-10 mt-[30vh] flex flex-col items-center px-6 pb-10 pt-4 fade-in-up">
        <h1 className="text-4xl font-bold sm:text-6xl">
          AsZUna&apos;s <span className="text-emerald-400">Gold Helper</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-slate-300 sm:text-base">
          Your trusted World of Warcraft gold-making hub — curated guides,
          tested routes, and real numbers for every expansion.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <a
            href="/guides"
            className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            View Gold Guides
          </a>
          <a
            href="/guides/beginner"
            className="rounded-xl border border-slate-700 px-6 py-2.5 text-sm text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            Start as a Beginner
          </a>
        </div>
      </section>

      {/* FEATURED GUIDES */}
      <section className="relative z-10 mb-16 w-full px-6">
        <div
          className="mx-auto flex max-w-5xl flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/70 px-4 py-5 text-left shadow-lg shadow-black/30 fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
                Featured Gold Guides
              </h2>
            </div>

            <Link
              href="/guides"
              className="self-start rounded-full border border-slate-700 px-3 py-1.5 text-[11px] text-slate-200 hover:border-emerald-500 hover:text-emerald-300 transition"
            >
              View all guides →
            </Link>
          </div>

          {/* Error */}
          {featuredError && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
              {featuredError}
            </div>
          )}

          {/* Loading skeleton */}
          {loadingFeatured && !featuredError && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80"
                />
              ))}
            </div>
          )}

          {/* No featured guides */}
          {!loadingFeatured &&
            !featuredError &&
            featuredGuides.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">
                No guides are featured yet. Mark some guides as{" "}
                <span className="text-emerald-300 font-semibold">
                  featured
                </span>{" "}
                in the admin panel and they&apos;ll appear here.
              </p>
            )}

          {/* Featured cards – reusing same style as Guides page */}
          {!loadingFeatured && featuredGuides.length > 0 && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredGuides.map((guide, index) => (
                <div
                  key={guide.id}
                  className="fade-in-up"
                  style={{ animationDelay: `${index * 0.1 + 0.3}s` }}
                >
                  <GuideCard guide={guide} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mb-4 text-center text-[10px] text-slate-500">
        © {new Date().getFullYear()} AsZUna&apos;s Gold Helper. World of
        Warcraft is a trademark of Blizzard Entertainment.
      </footer>
    </main>
  );
}

/* ----- Same GuideCard as on /guides (thumbnail/banner etc.) ----- */

function GuideCard({ guide }: { guide: GuideRow }) {
  const {
    id,
    title,
    slug,
    expansion,
    zone,
    gold_per_hour,
    difficulty,
    method_type,
    faction,
    is_featured,
    is_premium,
    thumbnail_urls,
  } = guide;

  const href = `/guides/${slug || id}`;
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
  const difficultyLower = difficultyLabel.toLowerCase();

  const difficultyColor =
    difficultyLower === "easy"
      ? "border-emerald-400/50 text-emerald-200 bg-emerald-500/10"
      : difficultyLower === "medium"
      ? "border-sky-400/50 text-sky-200 bg-sky-500/10"
      : difficultyLabel
      ? "border-rose-400/60 text-rose-200 bg-rose-500/15"
      : "border-slate-600/60 text-slate-200 bg-slate-800/40";

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 hover:border-emerald-500/60 hover:bg-slate-900/80 transition"
    >
      <div className="relative h-28 overflow-hidden">
        {firstThumb ? (
          <img
            src={firstThumb}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-950" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

        <div className="absolute inset-x-2 top-2 flex items-start justify-between">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-[3px] text-[9px] font-semibold shadow ${premiumColor}`}
          >
            {premiumLabel}
          </span>

          {goldPerHourNumber && (
            <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-slate-950/90 px-2 py-[3px] text-[9px] font-semibold text-amber-300">
              {goldPerHourNumber.toLocaleString()} GP/H
            </span>
          )}
        </div>

        {is_featured && (
          <div className="absolute bottom-2 left-2 rounded-full bg-emerald-500/20 px-2 py-[2px] text-[9px] font-semibold text-emerald-200 border border-emerald-400/50">
            ⭐ Featured
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3 py-3">
        <h2 className="line-clamp-2 text-sm font-semibold text-slate-50 group-hover:text-emerald-300">
          {title}
        </h2>

        <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-slate-400">
          {expansion && (
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-[1px]">
              {expansion}
            </span>
          )}
          {zone && (
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-[1px]">
              {zone}
            </span>
          )}
          {faction && (
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-[1px]">
              {faction}
            </span>
          )}
          {method_type && (
            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-[1px]">
              {method_type}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-[9px] text-slate-500">
          {difficultyLabel ? (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-[2px] font-semibold ${difficultyColor}`}
            >
              {difficultyLabel}
            </span>
          ) : (
            <span />
          )}

          <span className="text-[9px] text-slate-500 group-hover:text-slate-300">
            View guide →
          </span>
        </div>
      </div>
    </Link>
  );
}
