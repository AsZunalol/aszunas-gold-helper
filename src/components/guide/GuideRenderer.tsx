"use client";

import Image from "next/image";

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "video"; url: string; caption?: string } // YouTube/Vimeo/embed
  | { type: "tip"; text: string }
  | { type: "step"; title?: string; text: string }
  | { type: "quote"; text: string; by?: string }
  | { type: "divider" };

export function GuideRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <article className="prose prose-invert prose-emerald max-w-none">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            if (b.level === 1) return <h1 key={i}>{b.text}</h1>;
            if (b.level === 2) return <h2 key={i}>{b.text}</h2>;
            return <h3 key={i}>{b.text}</h3>;
          case "paragraph":
            return <p key={i}>{b.text}</p>;
          case "image":
            return (
              <figure key={i} className="my-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt={b.alt || ""} className="rounded-xl border border-slate-800" />
                {(b.caption || b.alt) && (
                  <figcaption className="mt-1 text-xs text-slate-400">{b.caption || b.alt}</figcaption>
                )}
              </figure>
            );
          case "video":
            return (
              <div key={i} className="my-4 aspect-video overflow-hidden rounded-xl border border-slate-800">
                <iframe
                  className="h-full w-full"
                  src={b.url}
                  title={b.caption || "Guide video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                {b.caption && (
                  <div className="mt-1 text-center text-xs text-slate-400">{b.caption}</div>
                )}
              </div>
            );
          case "tip":
            return (
              <div
                key={i}
                className="my-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"
              >
                <strong className="text-emerald-400">Goblin Tip:</strong> {b.text}
              </div>
            );
          case "step":
            return (
              <div
                key={i}
                className="my-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                {b.title && <div className="mb-1 text-xs font-semibold text-slate-300">{b.title}</div>}
                <div className="text-sm">{b.text}</div>
              </div>
            );
          case "quote":
            return (
              <blockquote key={i}>
                “{b.text}”{b.by ? <footer>— {b.by}</footer> : null}
              </blockquote>
            );
          case "divider":
            return <hr key={i} className="my-6 border-slate-800" />;
          default:
            return null;
        }
      })}
    </article>
  );
}
