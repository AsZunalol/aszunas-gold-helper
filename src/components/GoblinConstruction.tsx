interface GoblinConstructionProps {
  title?: string;
  message?: string;
}

export default function GoblinConstruction({
  title = "⚙️ Under Goblin Construction!",
  message = "Sorry, friend! The goblins are still hammerin’ out this part of AsZuna’s Gold Helper. They promised it’ll be *very* profitable when they’re done (assuming nothing explodes).",
}: GoblinConstructionProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-center text-slate-100 px-6">
      <div className="max-w-md space-y-4">
        {/* Wobbling wrench icon */}
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full border border-emerald-500/40 bg-slate-900/80 shadow-lg shadow-emerald-900/40 flex items-center justify-center">
            <span className="wobble-wrench text-2xl">🔧</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-emerald-400">{title}</h1>

        <p
          className="text-slate-300"
          dangerouslySetInnerHTML={{ __html: message }}
        />

        <p className="text-xs text-slate-500">
          Check back soon — or bribe a goblin engineer to speed things up.
        </p>

        <a
          href="/"
          className="inline-block mt-4 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          🧭 Back to Base Camp
        </a>
      </div>
    </main>
  );
}
