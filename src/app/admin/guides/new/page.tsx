"use client";

import { useEffect, useState, FormEvent } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { supabase } from "../../../../lib/supabaseClient"; // Supabase client

interface AghRole {
  name?: string;
  type?: string;
}
interface AghUser {
  id?: number;
  username?: string;
  email?: string;
  isGuideAdmin?: boolean;
  role?: AghRole;
}

type UploadedFile = {
  id: number;
  url: string;
  name?: string;
  alternativeText?: string;
  caption?: string;
};

type NewItemOfNote = {
  tempId: number;
  itemId: string;
  label: string;
  note: string;
  euAvg?: number | null;
  euSampleCount?: number;
  naAvg?: number | null;
  naSampleCount?: number;
  loadingPrices?: boolean;
  priceError?: string;
};

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const TINYMCE_API_KEY =
  process.env.NEXT_PUBLIC_TINYMCE_API_KEY || "no-api-key";

function isGuideAdminUser(u: AghUser | null) {
  if (!u) return false;
  if (u.isGuideAdmin === true) return true;
  const name = (u.role?.name || "").toLowerCase();
  const type = (u.role?.type || "").toLowerCase();
  const hay = `${name} ${type}`;
  return (
    /(guide).*(admin)/.test(hay) ||
    /(admin).*(guide)/.test(hay) ||
    hay.includes("guide-admin")
  );
}

function formatGold(copper: number | null | undefined): string {
  if (copper == null || isNaN(copper)) return "—";
  const c = Math.max(0, Math.floor(copper));
  const g = Math.floor(c / 10000);
  const s = Math.floor((c % 10000) / 100);
  const cc = c % 100;

  const parts: string[] = [];
  if (g > 0) parts.push(`${g}g`);
  if (s > 0 || g > 0)
    parts.push(`${s.toString().padStart(g > 0 ? 2 : 1, "0")}s`);
  parts.push(`${cc.toString().padStart(2, "0")}c`);

  return parts.join(" ");
}

export default function AdminCreateGuidePage() {
  const [user, setUser] = useState<AghUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  // HERO: Title + Thumbnails
  const [title, setTitle] = useState("");
  const [thumbnails, setThumbnails] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [thumbUrlInput, setThumbUrlInput] = useState("");

  // Meta fields
  const [expansion, setExpansion] = useState("Classic");
  const [zone, setZone] = useState("");
  const [goldPerHour, setGoldPerHour] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [methodType, setMethodType] = useState("Farming");
  const [recommendedLevel, setRecommendedLevel] = useState("");
  const [faction, setFaction] = useState("Both");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [lastTestedPatch, setLastTestedPatch] = useState("");
  const [contentHtml, setContentHtml] = useState(""); // TinyMCE content
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Items of Note editor state
  const [itemsOfNote, setItemsOfNote] = useState<NewItemOfNote[]>([]);

  // ✅ Auth + admin check via Supabase-backed agh_user in localStorage
  useEffect(() => {
    try {
      const rawUser =
        typeof window !== "undefined"
          ? window.localStorage.getItem("agh_user")
          : null;

      if (!rawUser) {
        setError("You must be logged in as a Guide Admin to create guides.");
        setChecking(false);
        return;
      }

      const parsed = JSON.parse(rawUser) as AghUser | null;

      if (!isGuideAdminUser(parsed)) {
        console.warn("AGH admin gate: parsed user =", parsed);
        setError("You do not have permission to access this page.");
        setChecking(false);
        return;
      }

      setUser(parsed);
      setChecking(false);
    } catch (err) {
      console.error(err);
      setError("Could not verify your session.");
      setChecking(false);
    }
  }, []);

  // --- Thumbnail helpers ---
  const removeThumbnail = (id: number) =>
    setThumbnails((prev) => prev.filter((f) => f.id !== id));

  const handleFileUpload = async (file: File) => {
    // NOTE: still using Strapi upload endpoint for now, but without auth token
    setUploading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("files", file);

      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: form,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        console.error("Upload failed:", res.status, data);
        setError(
          data?.error?.message ||
            (res.status === 403
              ? "Upload forbidden: check your Strapi upload permissions, or use URL thumbnails instead."
              : "Upload failed.")
        );
        setUploading(false);
        return;
      }

      const uploaded: UploadedFile[] = (data || []).map((f: any) => ({
        id: f.id,
        url: f.url?.startsWith("http") ? f.url : `${API_URL}${f.url}`,
        name: f.name,
        alternativeText: f.alternativeText,
        caption: f.caption,
      }));

      setThumbnails((prev) => [...prev, ...uploaded]);
    } catch (e) {
      console.error(e);
      setError("Could not upload thumbnail.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddThumbnailByUrl = () => {
    if (!thumbUrlInput.trim()) return;
    setThumbnails((prev) => [
      ...prev,
      { id: Date.now(), url: thumbUrlInput.trim() } as UploadedFile,
    ]);
    setThumbUrlInput("");
  };

  // Items of Note helpers (no search, manual ID)
  const addItemOfNoteRow = () => {
    setItemsOfNote((prev) => [
      ...prev,
      {
        tempId: Date.now() + Math.random(),
        itemId: "",
        label: "",
        note: "",
      },
    ]);
  };

  const updateItemOfNote = (
    tempId: number,
    field: keyof NewItemOfNote,
    value: string
  ) => {
    setItemsOfNote((prev) =>
      prev.map((row) =>
        row.tempId === tempId ? { ...row, [field]: value } : row
      )
    );
  };

  const removeItemOfNoteRow = (tempId: number) => {
    setItemsOfNote((prev) => prev.filter((row) => row.tempId !== tempId));
  };

  const fetchPricesForItem = async (tempId: number, itemIdStr: string) => {
    const idNum = Number(itemIdStr);
    if (!idNum || isNaN(idNum)) return;

    setItemsOfNote((prev) =>
      prev.map((row) =>
        row.tempId === tempId
          ? { ...row, loadingPrices: true, priceError: undefined }
          : row
      )
    );

    try {
      const res = await fetch(`/api/item-prices?itemId=${idNum}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();

      setItemsOfNote((prev) =>
        prev.map((row) =>
          row.tempId === tempId
            ? {
                ...row,
                euAvg: data?.eu?.avg ?? null,
                euSampleCount: data?.eu?.sampleCount ?? 0,
                naAvg: data?.na?.avg ?? null,
                naSampleCount: data?.na?.sampleCount ?? 0,
                loadingPrices: false,
                priceError: undefined,
              }
            : row
        )
      );
    } catch (err: any) {
      console.error("Item price fetch error", itemIdStr, err);
      setItemsOfNote((prev) =>
        prev.map((row) =>
          row.tempId === tempId
            ? {
                ...row,
                euAvg: null,
                euSampleCount: 0,
                naAvg: null,
                naSampleCount: 0,
                loadingPrices: false,
                priceError: "Failed to load item prices",
              }
            : row
        )
      );
    }
  };

  // Helper to slugify title
  function slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!contentHtml.trim()) {
      setError("Guide content is empty.");
      return;
    }

    setSubmitting(true);
    try {
      const goldPerHourNum =
        goldPerHour && !isNaN(Number(goldPerHour))
          ? Number(goldPerHour)
          : null;

      const slug = slugify(title);

      const thumbnailUrls = thumbnails.map((t) => t.url);

      // Prepare items of note for Supabase
      const itemsOfNotePayload = itemsOfNote
        .map((row) => {
          const idNum = Number(row.itemId);
          if (!idNum || Number.isNaN(idNum)) return null;
          return {
            itemId: idNum,
            label: row.label || `Item #${idNum}`,
            note: row.note || "",
          };
        })
        .filter(Boolean) as { itemId: number; label: string; note: string }[];

      // 1) Insert into guides table (Supabase)
      const { data: guideData, error: guideError } = await supabase
        .from("guides")
        .insert({
          title,
          slug,
          expansion: expansion || null,
          zone: zone || null,
          gold_per_hour: goldPerHourNum,
          difficulty: difficulty || null,
          method_type: methodType || null,
          recommended_level: recommendedLevel || null,
          faction: faction || null,
          is_featured: isFeatured,
          is_premium: isPremium,
          last_tested_patch: lastTestedPatch || null,
          content_html: contentHtml,
          thumbnail_urls: thumbnailUrls.length > 0 ? thumbnailUrls : null,
        })
        .select()
        .single();

      if (guideError || !guideData) {
        console.error("Supabase guide insert error:", guideError);
        setError(
          guideError?.message || "Failed to create guide in Supabase (guides)."
        );
        setSubmitting(false);
        return;
      }

      const guideId = guideData.id as number;

      // 2) Insert items of note into guide_items (Supabase)
      if (itemsOfNotePayload.length > 0) {
        const { error: itemsError } = await supabase.from("guide_items").insert(
          itemsOfNotePayload.map((it) => ({
            guide_id: guideId,
            item_id: it.itemId,
            label: it.label,
            note: it.note,
          }))
        );

        if (itemsError) {
          console.error("Supabase guide_items insert error:", itemsError);
          // We don't hard-fail the whole guide; just warn
          setError(
            `Guide saved, but failed to save items of note: ${itemsError.message}`
          );
        }
      }

      setSuccessMsg("Guide created successfully in Supabase!");
      setSubmitting(false);

      // Reset form
      setTitle("");
      setZone("");
      setGoldPerHour("");
      setRecommendedLevel("");
      setIsFeatured(false);
      setIsPremium(false);
      setLastTestedPatch("");
      setContentHtml("");
      setThumbnails([]);
      setItemsOfNote([]);
    } catch (err: any) {
      console.error("Unexpected submit error:", err);
      setError(err?.message || "Something went wrong while creating the guide.");
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm text-slate-400">Checking goblin credentials...</p>
      </main>
    );
  }

  if (error && !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200 px-6">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-xl font-semibold text-emerald-400">
            Access Denied
          </h1>
          <p className="text-sm text-slate-400">{error}</p>
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

  const firstThumb = thumbnails[0];
  const goldPerHourNumber =
    goldPerHour && !isNaN(Number(goldPerHour)) ? Number(goldPerHour) : null;

  const difficultyLabel = difficulty || "";
  const difficultyColor =
    difficultyLabel === "Easy"
      ? "border-emerald-400/50 text-emerald-200 bg-emerald-500/10"
      : difficultyLabel === "Medium"
      ? "border-sky-400/50 text-sky-200 bg-sky-500/10"
      : "border-rose-400/60 text-rose-200 bg-rose-500/15";

  const premiumLabel = isPremium ? "PREMIUM" : "FREE";
  const premiumColor = isPremium
    ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100"
    : "border-emerald-400/70 bg-emerald-500/15 text-emerald-100";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-emerald-400">
              Create New Guide
            </h1>
            <p className="text-[11px] text-slate-500">
              Logged in as {user?.username || user?.email} · Guide Admin
            </p>
          </div>
          <a
            href="/"
            className="text-[10px] text-slate-500 hover:text-emerald-400 transition"
          >
            ⬅ Back to site
          </a>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/90 p-5"
        >
          {error && (
            <p className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-[11px] text-red-300 break-words">
              {error}
            </p>
          )}
          {successMsg && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-300">
              {successMsg}
            </p>
          )}

          {/* HERO: Title + Thumbnail controls */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Title */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] text-slate-300">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                  placeholder="Hyper Farm in Azsuna - 45k Gold/hr"
                  required
                />
                <p className="text-[10px] text-slate-500">
                  This title will be shown on the public guide page and cards.
                </p>
              </div>

              {/* Thumbnail picker */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-300">
                  Thumbnail(s)
                </label>
                <div className="grid h-28 place-items-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-2">
                  <div className="text-center">
                    <input
                      id="thumb-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                      }}
                    />
                    <label
                      htmlFor="thumb-file"
                      className="inline-block cursor-pointer rounded border border-slate-700 px-2 py-1 text-[11px] hover:border-emerald-500 hover:text-emerald-400"
                    >
                      {uploading ? "Uploading…" : "Upload image"}
                    </label>

                    <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                      <span>or paste URL:</span>
                      <input
                        value={thumbUrlInput}
                        onChange={(e) => setThumbUrlInput(e.target.value)}
                        placeholder="https://…"
                        className="w-40 rounded border border-slate-700 bg-slate-950 px-2 py-1"
                      />
                      <button
                        type="button"
                        onClick={handleAddThumbnailByUrl}
                        className="rounded border border-slate-700 px-2 py-1 text-[11px] hover:border-emerald-500 hover:text-emerald-400"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {thumbnails.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {thumbnails.map((t) => (
                      <div
                        key={t.id}
                        className="relative overflow-hidden rounded-lg border border-slate-800"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.url}
                          alt={t.name || "thumbnail"}
                          className="h-24 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeThumbnail(t.id)}
                          className="absolute top-1 right-1 rounded bg-black/60 px-1.5 py-[2px] text-[10px] text-red-300 hover:bg-black/80"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-slate-500">
                  Thumbnails are saved as URLs in Supabase. You can either paste
                  external URLs or (if still configured) use the legacy Strapi
                  upload endpoint.
                </p>
              </div>
            </div>
          </div>

          {/* HERO PREVIEW with FREE/PREMIUM + GP/H + tags + difficulty */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden relative">
            {firstThumb ? (
              <div className="relative h-40 sm:h-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={firstThumb.url}
                  alt={firstThumb.name || "guide thumbnail"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent" />

                {/* PREMIUM / FREE top-left */}
                <div
                  className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-[10px] font-semibold shadow-lg ${premiumColor}`}
                >
                  {premiumLabel}
                </div>

                {/* GP/H top-right */}
                {goldPerHourNumber && goldPerHourNumber > 0 && (
                  <div className="absolute right-3 top-3 rounded-full border border-amber-400/40 bg-slate-950/90 px-3 py-1 text-xs font-semibold text-amber-300 shadow-lg">
                    {goldPerHourNumber.toLocaleString()} GP/H
                  </div>
                )}

                {/* Difficulty bottom-right */}
                {difficultyLabel && (
                  <div
                    className={`absolute bottom-3 right-3 rounded-full border px-3 py-1 text-[10px] font-semibold shadow-lg ${difficultyColor}`}
                  >
                    {difficultyLabel}
                  </div>
                )}

                <div className="absolute bottom-3 left-4 right-24">
                  <h2 className="text-lg sm:text-2xl font-semibold text-emerald-400">
                    {title || "Your guide title appears here"}
                  </h2>

                  {/* Tags */}
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
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative px-4 py-6">
                {/* PREMIUM / FREE */}
                <div
                  className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-[10px] font-semibold shadow-lg ${premiumColor}`}
                >
                  {premiumLabel}
                </div>

                {/* GP/H */}
                {goldPerHourNumber && goldPerHourNumber > 0 && (
                  <div className="absolute right-3 top-3 rounded-full border border-amber-400/40 bg-slate-950/90 px-3 py-1 text-xs font-semibold text-amber-300 shadow-lg">
                    {goldPerHourNumber.toLocaleString()} GP/H
                  </div>
                )}

                {/* Difficulty */}
                {difficultyLabel && (
                  <div
                    className={`absolute bottom-3 right-3 rounded-full border px-3 py-1 text-[10px] font-semibold shadow-lg ${difficultyColor}`}
                  >
                    {difficultyLabel}
                  </div>
                )}

                <h2 className="text-2xl font-semibold text-emerald-400">
                  {title || "Your guide title appears here"}
                </h2>

                <p className="mt-2 text-xs text-slate-500">
                  Hero preview will update as you set title, zone & meta.
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px] sm:text-[11px]">
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
                </div>
              </div>
            )}
          </div>

          {/* Expansion / Zone */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">Expansion</label>
              <select
                value={expansion}
                onChange={(e) => setExpansion(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
              >
                {[
                  "Classic",
                  "TBC",
                  "WotLK",
                  "Cata",
                  "MoP",
                  "WoD",
                  "Legion",
                  "BfA",
                  "Shadowlands",
                  "Dragonflight",
                  "The War Within",
                ].map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300">Zone</label>
              <input
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                placeholder="Azsuna, Hillsbrad Foothills, etc."
              />
            </div>
          </div>

          {/* Gold/hr, difficulty, method, faction + toggles */}
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">Gold / hr</label>
                <input
                  type="number"
                  min="0"
                  value={goldPerHour}
                  onChange={(e) => setGoldPerHour(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                  placeholder="45000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Sweaty Goblin</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">Method</label>
                <select
                  value={methodType}
                  onChange={(e) => setMethodType(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                >
                  <option>Farming</option>
                  <option>Crafting</option>
                  <option>Flipping</option>
                  <option>Transmog</option>
                  <option>Misc</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300">Faction</label>
                <select
                  value={faction}
                  onChange={(e) => setFaction(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                >
                  <option>Both</option>
                  <option>Horde</option>
                  <option>Alliance</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-[11px] text-slate-300">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                  className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-emerald-500"
                />
                <span>Premium guide</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-emerald-500"
                />
                <span>Featured on homepage</span>
              </label>
            </div>
          </div>

          {/* GUIDE CONTENT EDITOR (TinyMCE with WoW Item button & image upload) */}
          <div className="space-y-2">
            <label className="text-[11px] text-slate-300">
              Guide Content (TinyMCE)
            </label>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-1 py-1">
              <Editor
                apiKey={TINYMCE_API_KEY}
                value={contentHtml}
                onEditorChange={(value) => setContentHtml(value || "")}
                init={{
                  height: 400,
                  menubar: false,
                  statusbar: false,
                  skin: "oxide-dark",
                  content_css: "dark",
                  plugins: [
                    "advlist",
                    "autolink",
                    "lists",
                    "link",
                    "image",
                    "charmap",
                    "preview",
                    "anchor",
                    "searchreplace",
                    "visualblocks",
                    "code",
                    "fullscreen",
                    "insertdatetime",
                    "media",
                    "table",
                    "help",
                    "wordcount",
                  ],
                  toolbar:
                    "undo redo | blocks | bold italic underline | " +
                    "alignleft aligncenter alignright alignjustify | " +
                    "bullist numlist outdent indent | link image wowitem table | " +
                    "removeformat | code fullscreen",
                  block_formats:
                    "Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4",
                  content_style:
                    "body { font-family: system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; color:#e5e7eb; } a { color:#34d399; }",

                  // 🔽 Image upload support
                  automatic_uploads: true,
                  file_picker_types: "image",
                  images_upload_handler: async (
                    blobInfo: any,
                    success: (url: string) => void,
                    failure: (err: string) => void
                  ) => {
                    try {
                      const formData = new FormData();
                      formData.append(
                        "files",
                        blobInfo.blob(),
                        blobInfo.filename()
                      );

                      const res = await fetch(`${API_URL}/api/upload`, {
                        method: "POST",
                        body: formData,
                      });

                      if (!res.ok) {
                        console.error(
                          "TinyMCE image upload failed with status",
                          res.status
                        );
                        failure("Image upload failed");
                        return;
                      }

                      const data = await res.json();
                      const file = data?.[0];

                      if (!file || !file.url) {
                        console.error(
                          "TinyMCE image upload: invalid response",
                          data
                        );
                        failure("Invalid upload response");
                        return;
                      }

                      const url = file.url.startsWith("http")
                        ? file.url
                        : `${API_URL}${file.url}`;

                      success(url);
                    } catch (err) {
                      console.error("TinyMCE image upload error:", err);
                      failure("Image upload failed");
                    }
                  },

                  // Custom WoW item button
                  setup: (editor: any) => {
                    editor.ui.registry.addButton("wowitem", {
                      text: "WoW Item",
                      tooltip: "Insert Wowhead item link",
                      onAction: () => {
                        const itemId = window.prompt(
                          "Enter WoW item ID (example: 19019):"
                        );
                        if (!itemId) return;

                        const currentSelection = editor.selection.getContent({
                          format: "text",
                        });
                        const defaultText = currentSelection || `Item #${itemId}`;
                        const linkText =
                          window.prompt(
                            "Text to display for the item:",
                            defaultText
                          ) || defaultText;

                        const url = `https://www.wowhead.com/item=${itemId}`;
                        editor.insertContent(
                          `<a href="${url}" target="_blank" rel="noreferrer">${linkText}</a>`
                        );
                      },
                    });
                  },
                }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Use headings for sections, lists for steps, the <b>Image</b>{" "}
              button to upload screenshots, and the <b>WoW Item</b> button to
              insert Wowhead item links with tooltips.
            </p>
          </div>

          {/* ITEMS OF NOTE EDITOR */}
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  Items of Note
                </h2>
                <p className="text-[10px] text-slate-500">
                  Paste the numeric item ID from Wowhead. These items will get
                  live EU/NA auction prices on the public guide.
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Example:{" "}
                  <span className="font-mono">
                    https://www.wowhead.com/item=19019/...
                  </span>{" "}
                  → ID is <span className="font-mono">19019</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={addItemOfNoteRow}
                className="self-start rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                + Add item
              </button>
            </div>

            {itemsOfNote.length === 0 && (
              <p className="text-[11px] text-slate-500">
                No items added yet. Click &ldquo;Add item&rdquo; to track
                important drops.
              </p>
            )}

            {itemsOfNote.length > 0 && (
              <div className="space-y-3">
                {itemsOfNote.map((row, index) => {
                  const euText =
                    row.loadingPrices && !row.euAvg
                      ? "Loading..."
                      : row.euAvg && (row.euSampleCount || 0) > 0
                      ? `${formatGold(row.euAvg)} (${row.euSampleCount} samples)`
                      : "No data";

                  const naText =
                    row.loadingPrices && !row.naAvg
                      ? "Loading..."
                      : row.naAvg && (row.naSampleCount || 0) > 0
                      ? `${formatGold(row.naAvg)} (${row.naSampleCount} samples)`
                      : "No data";

                  return (
                    <div
                      key={row.tempId}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">
                          Item #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItemOfNoteRow(row.tempId)}
                          className="text-[10px] text-red-300 hover:text-red-200"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="space-y-1 md:col-span-1">
                          <label className="text-[11px] text-slate-300">
                            Item ID
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={row.itemId}
                            onChange={(e) =>
                              updateItemOfNote(
                                row.tempId,
                                "itemId",
                                e.target.value
                              )
                            }
                            onBlur={() =>
                              row.itemId &&
                              fetchPricesForItem(row.tempId, row.itemId)
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                            placeholder="e.g. 168586"
                          />
                          <p className="text-[10px] text-slate-500">
                            Numeric item ID from Wowhead URL.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              row.itemId &&
                              fetchPricesForItem(row.tempId, row.itemId)
                            }
                            className="mt-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
                          >
                            Fetch prices
                          </button>
                        </div>
                        <div className="space-y-1 md:col-span-3">
                          <label className="text-[11px] text-slate-300">
                            Label
                          </label>
                          <input
                            value={row.label}
                            onChange={(e) =>
                              updateItemOfNote(
                                row.tempId,
                                "label",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                            placeholder="Marrowroot, Monelite Ore, etc."
                          />
                          <label className="mt-2 block text-[11px] text-slate-300">
                            Note
                          </label>
                          <textarea
                            value={row.note}
                            onChange={(e) =>
                              updateItemOfNote(
                                row.tempId,
                                "note",
                                e.target.value
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                            placeholder="Why this item matters for the farm (e.g. main gold source, rare BoE, etc.)"
                            rows={2}
                          />
                          {(row.loadingPrices ||
                            row.euAvg ||
                            row.naAvg ||
                            row.priceError) && (
                            <div className="mt-2 text-[10px] text-slate-400">
                              <div>
                                <span className="font-semibold text-emerald-300">
                                  EU:
                                </span>{" "}
                                {euText}
                              </div>
                              <div>
                                <span className="font-semibold text-sky-300">
                                  NA:
                                </span>{" "}
                                {naText}
                              </div>
                              {row.priceError && (
                                <div className="text-red-300">
                                  {row.priceError}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LIVE PREVIEW */}
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Live Preview
              </h2>
              <p className="text-[10px] text-slate-500">
                This is roughly how the guide body will look.
              </p>
            </div>
            <article className="prose prose-invert max-w-none prose-headings:text-emerald-300 prose-a:text-emerald-400 prose-strong:text-emerald-200 prose-li:marker:text-emerald-400 prose-img:rounded-lg">
              {/* eslint-disable-next-line react/no-danger */}
              <div
                dangerouslySetInnerHTML={{
                  __html:
                    contentHtml.trim().length > 0
                      ? contentHtml
                      : "<p class='text-slate-500 text-xs'>Start writing in the editor above to see the preview...</p>",
                }}
              />
            </article>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Create Guide"}
          </button>
        </form>
      </div>
    </main>
  );
}
