"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface AghUser {
  id?: string;
  email?: string;
  username?: string;
  isGuideAdmin?: boolean;
}

export default function AdminHome() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AghUser | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        // Not logged in → yeet back to front page
        router.replace("/");
        return;
      }

      const u = session.user;

      const isGuideAdmin =
        (u.user_metadata?.isGuideAdmin as boolean | undefined) ??
        (u.app_metadata?.isGuideAdmin as boolean | undefined) ??
        false;

      if (!isGuideAdmin) {
        // Logged in but not an admin → also yeet
        router.replace("/");
        return;
      }

      const aghUser: AghUser = {
        id: u.id,
        email: u.email ?? undefined,
        username:
          (u.user_metadata?.username as string | undefined) ??
          (u.email ? u.email.split("@")[0] : "Goblin"),
        isGuideAdmin,
      };

      setUser(aghUser);
      setChecking(false);
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("agh_user");
      localStorage.removeItem("agh_token");
      window.dispatchEvent(new Event("agh_auth_changed"));
    }
    router.replace("/");
  };

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">Checking goblin credentials…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">
              🛠 AsZuna&apos;s Gold Helper — Admin
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Logged in as{" "}
              <span className="font-medium text-emerald-400">
                {user?.username ?? user?.email}
              </span>
              . You have goblin-grade guide admin access.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-emerald-500 hover:text-emerald-300 transition"
            >
              🧭 Back to site
            </a>
            <button
              onClick={handleLogout}
              className="text-xs rounded-lg bg-red-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-red-400 transition"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <a
            href="/admin/guides/new"
            className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 hover:border-emerald-500/60 hover:bg-slate-900/90 transition shadow-sm"
          >
            <h2 className="text-sm font-semibold text-slate-100">
              ✏️ Create New Guide
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Craft a fresh gold-making guide for the goblin archives.
            </p>
          </a>

          <a
            href="/admin/guides"
            className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 hover:border-emerald-500/60 hover:bg-slate-900/90 transition shadow-sm"
          >
            <h2 className="text-sm font-semibold text-slate-100">
              📚 Manage Guides
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              View, edit, or delete existing guides across all expansions.
            </p>
          </a>
        </section>
      </div>
    </main>
  );
}
