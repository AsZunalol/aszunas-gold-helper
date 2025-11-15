"use client";

import { useState } from "react";
import type { Block } from "./blocks";

type BuilderProps = {
  value: Block[];
  onChange: (v: Block[]) => void;
};

function sanitize(s: string) {
  // MVP: trim + remove \r; (you can add stricter sanitization later)
  return (s ?? "").replace(/\r/g, "").trimEnd();
}

function AddMenu({
  onAdd,
}: {
  onAdd: (b: Block) => void;
}) {
  const btn =
    "rounded-lg border border-slate-700 px-2 py-1 text-[11px] hover:border-emerald-500 hover:text-emerald-400";
  return (
    <div className="flex flex-wrap gap-2">
      <button className={btn} onClick={() => onAdd({ type: "heading", level: 2, text: "New Heading" })}>+ Heading</button>
      <button className={btn} onClick={() => onAdd({ type: "paragraph", text: "" })}>+ Paragraph</button>
      <button className={btn} onClick={() => onAdd({ type: "image", url: "", alt: "", caption: "" })}>+ Image</button>
      <button className={btn} onClick={() => onAdd({ type: "video", url: "", caption: "" })}>+ Video</button>
      <button className={btn} onClick={() => onAdd({ type: "tip", text: "" })}>+ Tip</button>
      <button className={btn} onClick={() => onAdd({ type: "step", title: "", text: "" })}>+ Step</button>
      <button className={btn} onClick={() => onAdd({ type: "quote", text: "", by: "" })}>+ Quote</button>
      <button className={btn} onClick={() => onAdd({ type: "divider" })}>+ Divider</button>
    </div>
  );
}

export function InlineGuideBuilder({ value, onChange }: BuilderProps) {
  const [blocks, setBlocks] = useState<Block[]>(value?.length ? value : [
    { type: "heading", level: 2, text: "New Guide" },
    { type: "paragraph", text: "Write your intro here…" },
  ]);

  const commit = (next: Block[]) => {
    setBlocks(next);
    onChange(next);
  };

  const update = (i: number, patch: Partial<Block>) => {
    const next = [...blocks];
    next[i] = { ...next[i], ...patch } as Block;
    commit(next);
  };

  const remove = (i: number) => commit(blocks.filter((_, idx) => idx !== i));

  const insertAt = (i: number, b: Block) => {
    const next = [...blocks];
    next.splice(i, 0, b);
    commit(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const toolbarBtn =
    "rounded border border-slate-700 px-2 py-0.5 text-[11px] hover:border-emerald-500 hover:text-emerald-400";
  const blockCard =
    "relative rounded-xl border border-slate-800 bg-slate-900/50 p-3";

  return (
    <div className="space-y-4">
      {/* Top add menu */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <AddMenu onAdd={(b) => insertAt(0, b)} />
      </div>

      {blocks.map((b, i) => (
        <div key={i} className={blockCard}>
          <div className="absolute -top-3 right-3 flex gap-2">
            <button className={toolbarBtn} onClick={() => move(i, -1)}>↑</button>
            <button className={toolbarBtn} onClick={() => move(i, +1)}>↓</button>
            <button className="rounded border border-red-700 px-2 py-0.5 text-[11px] text-red-300 hover:border-red-500" onClick={() => remove(i)}>Delete</button>
          </div>

          {/* Editable inline render per type */}
          {b.type === "heading" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                Heading
                <select
                  value={b.level}
                  onChange={(e) =>
                    update(i, { level: Number(e.target.value) as 1 | 2 | 3 })
                  }
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                >
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
              </div>
              {b.level === 1 && (
                <h1
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => update(i, { text: sanitize(e.currentTarget.textContent || "") })}
                  className="outline-none"
                >
                  {b.text}
                </h1>
              )}
              {b.level === 2 && (
                <h2
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => update(i, { text: sanitize(e.currentTarget.textContent || "") })}
                  className="outline-none"
                >
                  {b.text}
                </h2>
              )}
              {b.level === 3 && (
                <h3
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => update(i, { text: sanitize(e.currentTarget.textContent || "") })}
                  className="outline-none"
                >
                  {b.text}
                </h3>
              )}
            </div>
          )}

          {b.type === "paragraph" && (
            <p
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => update(i, { text: sanitize(e.currentTarget.textContent || "") })}
              className="min-h-[24px] outline-none"
            >
              {b.text}
            </p>
          )}

          {b.type === "image" && (
            <figure className="my-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.url ? (
                <img
                  src={b.url}
                  alt={b.alt || ""}
                  className="rounded-xl border border-slate-800"
                />
              ) : (
                <div className="grid place-items-center h-40 rounded-xl border border-dashed border-slate-700 text-slate-500 text-xs">
                  Paste/enter an image URL below
                </div>
              )}
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <input
                  value={b.url}
                  onChange={(e) => update(i, { url: e.target.value })}
                  placeholder="Image URL (or /uploads/…)"
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs md:col-span-2"
                />
                <input
                  value={b.alt || ""}
                  onChange={(e) => update(i, { alt: e.target.value })}
                  placeholder="Alt"
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                />
                <input
                  value={b.caption || ""}
                  onChange={(e) => update(i, { caption: e.target.value })}
                  placeholder="Caption"
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs md:col-span-3"
                />
              </div>
            </figure>
          )}

          {b.type === "video" && (
            <div className="space-y-2">
              <div className="aspect-video overflow-hidden rounded-xl border border-slate-800">
                {b.url ? (
                  <iframe
                    className="h-full w-full"
                    src={b.url}
                    title={b.caption || "Guide video"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-slate-500">
                    Paste an embed URL (YouTube/Vimeo)
                  </div>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  value={b.url}
                  onChange={(e) => update(i, { url: e.target.value })}
                  placeholder="Embed URL (YouTube embed link)"
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs md:col-span-2"
                />
                <input
                  value={b.caption || ""}
                  onChange={(e) => update(i, { caption: e.target.value })}
                  placeholder="Caption"
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                />
              </div>
            </div>
          )}

          {b.type === "tip" && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <strong className="text-emerald-400">Goblin Tip:</strong>{" "}
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => update(i, { text: sanitize(e.currentTarget.textContent || "") })}
                className="outline-none"
              >
                {b.text}
              </span>
            </div>
          )}

          {b.type === "step" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => update(i, { title: sanitize(e.currentTarget.textContent || "") })}
                className="mb-1 text-xs font-semibold text-slate-300 outline-none"
              >
                {b.title || "Step title (optional)"}
              </div>
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => update(i, { text: sanitize(e.currentTarget.textContent || "") })}
                className="text-sm outline-none min-h-[20px]"
              >
                {b.text || "Explain the step…"}
              </div>
            </div>
          )}

          {b.type === "quote" && (
            <blockquote className="border-l-4 border-slate-700 pl-3">
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => update(i, { text: sanitize(e.currentTarget.textContent || "") })}
                className="italic outline-none"
              >
                {b.text || "Quoted text…"}
              </div>
              <footer
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => update(i, { by: sanitize(e.currentTarget.textContent || "") })}
                className="mt-1 text-xs text-slate-400 outline-none"
              >
                {b.by ? `— ${b.by}` : "— Author"}
              </footer>
            </blockquote>
          )}

          {b.type === "divider" && <hr className="my-4 border-slate-800" />}

          {/* inline add menu (after this block) */}
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-2">
            <AddMenu onAdd={(b) => insertAt(i + 1, b)} />
          </div>
        </div>
      ))}

      {/* bottom add menu */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <AddMenu onAdd={(b) => insertAt(blocks.length, b)} />
      </div>
    </div>
  );
}
