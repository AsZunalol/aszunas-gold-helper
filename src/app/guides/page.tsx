"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { LoginModal } from "@/components/LoginModal";
import { RegisterModal } from "@/components/RegisterModal";

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

interface AghRole {
  name?: string;
  type?: string;
}

interface AghUser {
  username?: string;
  email?: string;
  role?: AghRole;
}

const API_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

function isGuideAdminRole(role?: AghRole): boolean {
  if (!role) return false;
  const name = (role.name || "").toLowerCase().trim();
  const type = (role.type || "").toLowerCase().trim();
  const hay = `${name} ${type}`;
  return (
    /(guide).*(admin)/.test(hay) ||
    /(admin).*(guide)/.test(hay) ||
    hay.includes("guide-admin")
  );
}

export default function GuidesListPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState<AghUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const rawUser =
          typeof window !== "undefined"
            ? window.localStorage.getItem("agh_user")
            : null;
        const rawToken =
          typeof window !== "undefined"
            ? window.localStorage.getItem("agh_token")
            : null;

        let parsed: AghUser | null = rawUser ? JSON.parse(rawUser) : null;

        if (rawToken && (!parsed || !parsed.role)) {
          const meRes = await fetch(`${API_URL}/api/users/me?populate=role`, {
            headers: { Authorization: `Bearer ${rawToken}` },
          });
          if (meRes.ok) {
            parsed = await meRes.json();
            localStorage.setItem("agh_user", JSON.stringify(parsed));
          }
        }

        setUser(parsed);
      } catch {
        setUser(null);
      }
    };

    loadUser();

    const handler = () => loadUser();
    window.addEventListener("agh-auth-changed", handler);
    return () => window.removeEventListener("agh-auth-changed", handler);
  }, []);

  const isGuideAdmin = isGuideAdminRole(user?.role);

  const openLogin = () => {
    setMenuOpen(false);
    setRegisterOpen(false);
    setProfileOpen(false);
    setLoginOpen(true);
  };

  const openRegister = () => {
    setMenuOpen(false);
    setLoginOpen(false);
    setProfileOpen(false);
    setRegisterOpen(true);
  };

  const closeLogin = () => setLoginOpen(false);
  const closeRegister = () => setRegisterOpen(false);

  const toggleProfile = () => setProfileOpen((v) => !v);

  const logout = () => {
    localStorage.removeItem("agh_token");
    localStorage.removeItem("agh_user");
    window.dispatchEvent(new Event("agh-auth-changed"));
    setProfileOpen(false);
  };

  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [expansionFilter, setExpansionFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [premiumFilter, setPremiumFilter] =
    useState<"all" | "free" | "premium">("all");

  const [isSpinning, setIsSpinning] = useState(false);
  const [currentSpinIndex, setCurrentSpinIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadGuides = async () => {
      setLoading(true);
      setError(null);

      try {
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
          .order("is_featured", { ascending: false })
          .order("id", { ascending: false });

        if (error) {
          console.error(error);
          setError("Failed to load guides.");
          setGuides([]);
          setLoading(false);
          return;
        }

        setGuides((data || []) as GuideRow[]);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Failed to load guides.");
        setGuides([]);
        setLoading(false);
      }
    };

    loadGuides();
  }, []);

  const filteredGuides = useMemo(() => {
    let list = [...guides];

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => {
        const hay = [
          g.title || "",
          g.expansion || "",
          g.zone || "",
          g.method_type || "",
          g.faction || "",
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      });
    }

    if (expansionFilter !== "all") {
      list = list.filter(
        (g) => (g.expansion || "").toLowerCase() === expansionFilter
      );
    }

    if (difficultyFilter !== "all") {
      list = list.filter(
        (g) => (g.difficulty || "").toLowerCase() === difficultyFilter
      );
    }

    if (premiumFilter === "free") list = list.filter((g) => !g.is_premium);
    if (premiumFilter === "premium") list = list.filter((g) => g.is_premium);

    return list;
  }, [
    guides,
    searchTerm,
    expansionFilter,
    difficultyFilter,
    premiumFilter,
  ]);

  const totalCount = guides.length;
  const filteredCount = filteredGuides.length;

  const handleRandomGuideSpin = () => {
    if (isSpinning || filteredGuides.length === 0) return;
    if (typeof window === "undefined") return;

    setIsSpinning(true);

    let ticks = 0;
    const totalTicks = 24 + Math.floor(Math.random() * 12); // random-ish spin length
    let currentIndex = -1;

    const spinInterval = window.setInterval(() => {
      ticks += 1;
      currentIndex = (currentIndex + 1) % filteredGuides.length;
      setCurrentSpinIndex(currentIndex);

      if (ticks >= totalTicks) {
        window.clearInterval(spinInterval);

        const finalIndex =
          filteredGuides.length === 1
            ? 0
            : Math.floor(Math.random() * filteredGuides.length);

        setCurrentSpinIndex(finalIndex);

        const chosen = filteredGuides[finalIndex];

        setTimeout(() => {
          const href = `/guides/${chosen.slug || chosen.id}`;
          router.push(href);
        }, 650);

        setTimeout(() => {
          setIsSpinning(false);
          setCurrentSpinIndex(null);
        }, 1200);
      }
    }, 90);
  };

  return (
    <main
      className="
        relative min-h-screen text-slate-100
        bg-[url('/bg.jpg')]
        bg-cover bg-center bg-fixed bg-no-repeat
      "
    >
      <div className="backdrop-blur-sm min-h-screen bg-slate-950/70">
        {/* NAVBAR */}
        <header
          className="
            fixed top-4 left-1/2 z-30 flex w-[90%] max-w-5xl -translate-x-1/2
            items-center justify-between rounded-full
            border border-slate-800/60 bg-slate-900/80
            px-5 py-3 text-sm backdrop-blur-md shadow-lg shadow-black/20
          "
        >
          <a
            href="/"
            className="font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            AsZUna's Gold Helper
          </a>

          <nav className="hidden items-center gap-6 text-xs text-slate-300 md:flex relative">
            <a href="/guides" className="hover:text-emerald-400 transition">
              Guides
            </a>
            <a href="/about" className="hover:text-emerald-400 transition">
              About
            </a>

            {!user && (
              <button
                onClick={openLogin}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-emerald-500 hover:text-emerald-400 transition"
              >
                Login
              </button>
            )}

            {user && (
              <div className="relative">
                <button
                  onClick={toggleProfile}
                  className="
                    flex items-center gap-2 rounded-full border border-slate-700
                    px-3 py-1.5 text-xs text-slate-200
                    hover:border-emerald-500 hover:text-emerald-400 transition
                  "
                >
                  <span className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-[10px]">
                    {user.username?.charAt(0).toUpperCase() ||
                      user.email?.charAt(0).toUpperCase() ||
                      "A"}
                  </span>
                  <span>{user.username || user.email || "Profile"}</span>
                </button>

                {profileOpen && (
                  <div
                    className="
                      absolute right-0 mt-2 w-44 rounded-xl border border-slate-800
                      bg-slate-950/98 py-2 text-[11px] text-slate-200 shadow-xl
                    "
                  >
                    {isGuideAdmin && (
                      <a
                        href="/admin/guides/new"
                        className="block px-3 py-1.5 hover:bg-slate-900/90 hover:text-emerald-400 transition"
                        onClick={() => setProfileOpen(false)}
                      >
                        Guide Admin
                      </a>
                    )}
                    <button
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-emerald-400 transition"
                      onClick={() => setProfileOpen(false)}
                    >
                      Profile
                    </button>
                    <button
                      className="w-full px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-red-400 transition"
                      onClick={logout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>

          <button
            onClick={() => {
              setMenuOpen((v) => !v);
              setProfileOpen(false);
            }}
            className="
              md:hidden inline-flex items-center justify-center
              h-8 w-8 rounded-full border border-slate-700
              text-slate-200 hover:border-emerald-500 hover:text-emerald-400 transition
            "
          >
            <span className="sr-only">Menu</span>
            <div className="space-y-1">
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
            </div>
          </button>
        </header>

        {menuOpen && (
          <div
            className="
              fixed top-16 left-1/2 z-20 w-[82%] max-w-xs -translate-x-1/2
              rounded-2xl border border-slate-800/70 bg-slate-950/95
              px-4 py-3 text-xs text-slate-200 backdrop-blur-md
              md:hidden
            "
          >
            <nav className="flex flex-col gap-2 text-left">
              <a
                href="/guides"
                className="py-1 hover:text-emerald-400 transition"
                onClick={() => setMenuOpen(false)}
              >
                Guides
              </a>
              <a
                href="/about"
                className="py-1 hover:text-emerald-400 transition"
                onClick={() => setMenuOpen(false)}
              >
                About
              </a>

              {!user && (
                <>
                  <button
                    onClick={openLogin}
                    className="mt-1 rounded-full border border-slate-700 px-3 py-1.5 text-center hover:border-emerald-500 hover:text-emerald-400 transition"
                  >
                    Login
                  </button>
                  <button
                    onClick={openRegister}
                    className="mt-1 rounded-full border border-slate-800 px-3 py-1.5 text-center text-[10px] text-slate-300 hover:border-emerald-500 hover:text-emerald-400 transition"
                  >
                    Create Account
                  </button>
                </>
              )}

              {user && (
                <div className="mt-2 space-y-1">
                  <div className="px-2 py-1 text-[10px] text-slate-500">
                    Logged in as{" "}
                    <span className="text-emerald-400">
                      {user.username || user.email}
                    </span>
                  </div>

                  {isGuideAdmin && (
                    <a
                      href="/admin/guides/new"
                      className="w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-emerald-400 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      Guide Admin
                    </a>
                  )}

                  <button
                    className="w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-emerald-400 transition"
                    onClick={() => {
                      setMenuOpen(false);
                    }}
                  >
                    Profile
                  </button>
                  <button
                    className="w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-red-400 transition"
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}

        {/* PAGE CONTENT */}
        <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-24">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-emerald-400">
                Gold Guides
              </h1>
              <p className="mt-1 text-[11px] text-slate-400">
                Browse AsZUna's goblin-tested farms, flips, and routes.
              </p>
            </div>
            <Link
              href="/"
              className="text-[10px] text-slate-500 hover:text-emerald-400 transition"
            >
              ⬅ Back to AsZUna's Gold Helper
            </Link>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">
                Search
              </label>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, zone, expansion..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              <select
                value={expansionFilter}
                onChange={(e) => setExpansionFilter(e.target.value)}
                className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] text-slate-200 outline-none focus:border-emerald-500"
              >
                <option value="all">All Expansions</option>
                <option value="classic">Classic</option>
                <option value="tbc">TBC</option>
                <option value="wotlk">WotLK</option>
                <option value="cata">Cata</option>
                <option value="mop">MoP</option>
                <option value="wod">WoD</option>
                <option value="legion">Legion</option>
                <option value="bfa">BFA</option>
                <option value="shadowlands">Shadowlands</option>
                <option value="dragonflight">Dragonflight</option>
                <option value="tww">TWW</option>
              </select>

              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] text-slate-200 outline-none focus:border-sky-500"
              >
                <option value="all">All difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <select
                value={premiumFilter}
                onChange={(e) =>
                  setPremiumFilter(e.target.value as "all" | "free" | "premium")
                }
                className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] text-slate-200 outline-none focus:border-fuchsia-500"
              >
                <option value="all">All guides</option>
                <option value="free">Free only</option>
                <option value="premium">Premium only</option>
              </select>

              <button
                type="button"
                onClick={handleRandomGuideSpin}
                disabled={filteredGuides.length === 0 || isSpinning}
                className={`
                  inline-flex items-center gap-2 rounded-full border
                  border-amber-400/70 bg-amber-500/20 px-4 py-1.5 text-[10px] font-semibold
                  text-amber-100 shadow-md shadow-amber-900/40
                  transition hover:bg-amber-500/30 hover:border-amber-300
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <span className={isSpinning ? "animate-spin" : ""}>🎰</span>
                {isSpinning ? "Spinning guides..." : "Open a random guide"}
              </button>
            </div>
          </div>

          <div className="mb-3 text-[10px] text-slate-500">
            Showing{" "}
            <span className="text-emerald-300 font-semibold">
              {filteredCount}
            </span>{" "}
            of{" "}
            <span className="text-slate-300 font-semibold">{totalCount}</span>{" "}
            guides.
          </div>

          {loading && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-400">
              Summoning goblin scribes…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && filteredGuides.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-400">
              No guides match these filters.
            </div>
          )}

          {!loading && !error && filteredGuides.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGuides.map((guide, index) => (
                <GuideCard
                  key={guide.id}
                  guide={guide}
                  highlighted={isSpinning && index === currentSpinIndex}
                />
              ))}
            </div>
          )}
        </div>

        <LoginModal
          open={loginOpen}
          onClose={closeLogin}
          onOpenRegister={openRegister}
        />
        <RegisterModal
          open={registerOpen}
          onClose={closeRegister}
          onOpenLogin={openLogin}
        />
      </div>
    </main>
  );
}

function GuideCard({
  guide,
  highlighted = false,
}: {
  guide: GuideRow;
  highlighted?: boolean;
}) {
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
      className={`
        group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80
        hover:border-emerald-500/60 hover:bg-slate-900/80 transition
        ${
          highlighted
            ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 scale-[1.02] shadow-amber-500/60"
            : ""
        }
      `}
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
