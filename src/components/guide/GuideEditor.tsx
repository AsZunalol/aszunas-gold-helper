"use client";

import { useState } from "react";
import type { Block } from "./GuideRenderer";
import { GuideRenderer } from "./GuideRenderer";

type Props = {
  value: Block[];
  onChange: (v: Block[]) => void;
};

const emptyPara: Block = { type: "paragraph", text: "" };

export function GuideEditor({ value, onChange }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(value?.length ? value : [emptyPara]);

  const commit = (next: Block[]) => {
    setBlocks(next);
    onChange(next);
  };

  const add = (b: Block) => commit([...blocks, b]);
  const remove = (idx: number) => commit(blocks.filter((_, i) => i !== idx));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...blocks];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    commit(next);
  };

  const update = (idx: number, patch: Partial<Block>) => {
    const next = [...blocks];
    next[idx] = { ...next[idx], ...patch } as Block;
    commit(next);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Left: Block Controls */}
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
        <div className="mb-2 text-xs font-semibold text-slate-300">Blocks</div>

        {/* Palette */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          <button onClick={() => add({ type: "heading", level: 2, text: "New Heading" })}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:border-emerald-500 hover:text-emerald-400">
            + Heading
          </button>
          <button onClick={() => add({ type: "paragraph", text: "" })}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:border-emerald-500 hover:text-emerald-400">
            + Paragraph
          </button>
          <button onClick={() => add({ type: "image", url: "", alt: "" })}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:border-emerald-500 hover:text-emerald-400">
            + Image
          </button>
          <button onClick={() => add({ type: "video", url: "" })}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:border-emerald-500 hover:text-emerald-400">
            + Video
          </button>
          <button onClick={() => add({ type: "tip", text: "" })}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:border-emerald-500 hover:text-emerald-400">
            + Tip
          </button>
          <button onClick={() => add({ type: "step", title: "", text: "" })}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:border-emerald-500 hover:text-emerald-400">
            + Step
          </button>
          <button onClick={() => add({ type: "quote", text: "", by: "" })}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:border-emerald-500 hover:text-emerald-400">
            + Quote
          </button>
          <button onClick={() => add({ type: "divider" })}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:border-emerald-500 hover:text-emerald-400">
            + Divider
          </button>
        </div>

        {/* Block List */}
        <div className="space-y-3">
          {blocks.map((b, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{b.type}</span>
                <div className="flex items-center gap-2 text-[11px]">
                  <button onClick={() => move(i, -1)} className="rounded border border-slate-700 px-2 py-0.5 hover:border-emerald-500">↑</button>
                  <button onClick={() => move(i, +1)} className="rounded border border-slate-700 px-2 py-0.5 hover:border-emerald-500">↓</button>
                  <button onClick={() => remove(i)} className="rounded border border-red-700 px-2 py-0.5 text-red-300 hover:border-red-500">Delete</button>
                </div>
              </div>

              {/* Inline editors per block type */}
              {b.type === "heading" && (
                <div className="flex gap-2">
                  <select
                    value={b.level}
                    onChange={(e) => update(i, { level: Number(e.target.value) as 1|2|3 })}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  >
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                  <input
                    value={b.text}
                    onChange={(e) => update(i, { text: e.target.value })}
                    placeholder="Heading text"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                </div>
              )}

              {b.type === "paragraph" && (
                <textarea
                  value={b.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                  placeholder="Write your paragraph…"
                  className="min-h-[80px] w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                />
              )}

              {b.type === "image" && (
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={b.url}
                    onChange={(e) => update(i, { url: e.target.value })}
                    placeholder="https://… (or /uploads/…)"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                  <input
                    value={b.alt || ""}
                    onChange={(e) => update(i, { alt: e.target.value })}
                    placeholder="Alt text"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                  <input
                    value={b.caption || ""}
                    onChange={(e) => update(i, { caption: e.target.value })}
                    placeholder="Caption (optional)"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs md:col-span-2"
                  />
                </div>
              )}

              {b.type === "video" && (
                <div className="grid gap-2">
                  <input
                    value={b.url}
                    onChange={(e) => update(i, { url: e.target.value })}
                    placeholder="Embed URL (YouTube embed link)"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                  <input
                    value={b.caption || ""}
                    onChange={(e) => update(i, { caption: e.target.value })}
                    placeholder="Caption (optional)"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                </div>
              )}

              {b.type === "tip" && (
                <textarea
                  value={b.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                  placeholder="Gold-making tip…"
                  className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                />
              )}

              {b.type === "step" && (
                <div className="grid gap-2">
                  <input
                    value={b.title || ""}
                    onChange={(e) => update(i, { title: e.target.value })}
                    placeholder="Step title (optional)"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                  <textarea
                    value={b.text}
                    onChange={(e) => update(i, { text: e.target.value })}
                    placeholder="Explain the step…"
                    className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                </div>
              )}

              {b.type === "quote" && (
                <div className="grid gap-2">
                  <textarea
                    value={b.text}
                    onChange={(e) => update(i, { text: e.target.value })}
                    placeholder="Quoted text…"
                    className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                  <input
                    value={b.by || ""}
                    onChange={(e) => update(i, { by: e.target.value })}
                    placeholder="— Who said it?"
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Live Preview */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="mb-3 text-xs font-semibold text-slate-300">Live Preview</div>
        <GuideRenderer blocks={blocks} />
      </div>
    </div>
  );
}
