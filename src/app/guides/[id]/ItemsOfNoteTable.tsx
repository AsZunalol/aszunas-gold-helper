"use client";

import { useEffect, useState } from "react";

export interface ItemOfNote {
  id?: number;
  itemId: number;
  label: string;
  note?: string | null;
}

type PriceSide = {
  avg: number | null;
  sampleCount: number;
};

type PriceData = {
  itemId: number;
  eu?: PriceSide;
  na?: PriceSide;
};

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

export function ItemsOfNoteTable({ items }: { items: ItemOfNote[] }) {
  const [prices, setPrices] = useState<Record<number, PriceData>>({});
  const [loadingIds, setLoadingIds] = useState<number[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      if (!items || items.length === 0) {
        setPrices({});
        setLoadingIds([]);
        return;
      }

      const ids = items.map((i) => i.itemId).filter(Boolean);
      const unique = Array.from(new Set(ids));

      setLoadingIds(unique);

      const newPrices: Record<number, PriceData> = {};

      await Promise.all(
        unique.map(async (id) => {
          try {
            const res = await fetch(`/api/item-prices?itemId=${id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            newPrices[id] = {
              itemId: id,
              eu: data.eu || undefined,
              na: data.na || undefined,
            };
          } catch (err) {
            console.error("Failed to fetch prices for item", id, err);
            newPrices[id] = { itemId: id };
          }
        })
      );

      setPrices(newPrices);
      setLoadingIds([]);
    };

    fetchAll();
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Items of Note
          </h2>
          <p className="text-[10px] text-slate-500">
            Key loot with average EU / NA auction prices.
          </p>
        </div>
      </div>

      <div className="mt-1 space-y-2">
        {items.map((item) => {
          const p = prices[item.itemId];
          const loading = loadingIds.includes(item.itemId);

          const euText =
            loading && !p?.eu?.avg
              ? "Loading..."
              : p?.eu?.avg && (p.eu.sampleCount || 0) > 0
              ? `${formatGold(p.eu.avg)} (${p.eu.sampleCount} samples)`
              : "No data";

          const naText =
            loading && !p?.na?.avg
              ? "Loading..."
              : p?.na?.avg && (p.na.sampleCount || 0) > 0
              ? `${formatGold(p.na.avg)} (${p.na.sampleCount} samples)`
              : "No data";

          const wowheadUrl = `https://www.wowhead.com/item=${item.itemId}`;

          return (
            <div
              key={item.itemId + "-" + (item.id ?? "")}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <a
                    href={wowheadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    {item.label || `Item #${item.itemId}`}
                  </a>
                  <p className="mt-1 text-[10px] text-slate-400">
                    ID: <span className="font-mono">{item.itemId}</span>
                  </p>
                  {item.note && (
                    <p className="mt-1 text-[11px] text-slate-300">
                      {item.note}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-emerald-300">EU</span>
                  </div>
                  <div className="text-slate-200">{euText}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-sky-300">NA</span>
                  </div>
                  <div className="text-slate-200">{naText}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
