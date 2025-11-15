"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoginModal } from "@/components/LoginModal";
import { RegisterModal } from "@/components/RegisterModal";
import { supabase } from "@/lib/supabaseClient";

interface AghRole {
  name?: string;
  type?: string;
}

interface AghUser {
  id?: number | string;
  username?: string;
  email?: string;
  role?: AghRole | null;
  // Supabase-style flags
  isGuideAdmin?: boolean;
  is_guide_admin?: boolean;
  membershipType?: string;
}

function isGuideAdminUser(user: AghUser | null): boolean {
  if (!user) return false;

  // Supabase-style flags first
  if (user.isGuideAdmin === true || user.is_guide_admin === true) return true;

  // Fallback to role (old Strapi-style data)
  const roleName = (user.role?.name || "").toLowerCase();
  const roleType = (user.role?.type || "").toLowerCase();
  const hay = `${roleName} ${roleType}`;

  if (!hay.trim()) return false;

  if (hay.includes("guide admin") || hay.includes("guide-admin")) return true;
  if (roleName.includes("admin") && roleName.includes("guide")) return true;
  if (roleType.includes("admin") && roleType.includes("guide")) return true;

  return false;
}

function hasPremiumMembership(user: AghUser | null): boolean {
  if (!user?.membershipType) return false;
  const v = user.membershipType.toLowerCase();
  return v === "premium" || v === "lifetime" || v === "founder";
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [user, setUser] = useState<AghUser | null>(null);

  // Load user based on Supabase session + profiles (with legacy localStorage fallback)
  useEffect(() => {
    const loadUser = async () => {
      try {
        // 1) Check Supabase session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // If there's no Supabase user, fall back to whatever is in localStorage (legacy)
        if (!session?.user) {
          if (typeof window !== "undefined") {
            const raw = window.localStorage.getItem("agh_user");
            setUser(raw ? (JSON.parse(raw) as AghUser) : null);
          } else {
            setUser(null);
          }
          return;
        }

        const u = session.user;

        // 2) Fetch profile row (username, membership, guide admin flag)
        let usernameFromProfile: string | undefined = undefined;
        let membershipType: string | undefined = "free";
        let isGuideAdmin = false;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("username, membership_type, is_guide_admin")
          .eq("id", u.id)
          .single();

        if (!profileError && profile) {
          usernameFromProfile = (profile as any).username || undefined;
          membershipType = (profile as any).membership_type || "free";
          isGuideAdmin = !!(profile as any).is_guide_admin;
        }

        // 3) Build a normalized AghUser shape
        const localUser: AghUser = {
          id: u.id,
          username:
            usernameFromProfile ||
            (u.user_metadata?.username as string | undefined) ||
            u.email?.split("@")[0] ||
            undefined,
          email: u.email ?? undefined,
          membershipType,
          // Supabase-style flags
          isGuideAdmin,
          is_guide_admin: isGuideAdmin,
          // Legacy-style role information for old helpers
          role: {
            name: isGuideAdmin ? "Guide Admin" : "Supabase User",
            type: isGuideAdmin ? "guide-admin" : "supabase-user",
          },
        };

        // 4) Store for other parts of the app and update state
        if (typeof window !== "undefined") {
          window.localStorage.setItem("agh_user", JSON.stringify(localUser));
        }

        setUser(localUser);
      } catch (err) {
        console.error(
          "Navbar: failed to load user from Supabase/localStorage",
          err
        );
        try {
          if (typeof window !== "undefined") {
            const raw = window.localStorage.getItem("agh_user");
            setUser(raw ? (JSON.parse(raw) as AghUser) : null);
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      }
    };

    loadUser();

    const handler = () => loadUser();
    if (typeof window !== "undefined") {
      window.addEventListener("agh-auth-changed", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("agh-auth-changed", handler);
      }
    };
  }, []);

  const isGuideAdmin = isGuideAdminUser(user);
  const isPremiumMember = hasPremiumMembership(user);

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

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Navbar logout: Supabase signOut failed", err);
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("agh_token");
      window.localStorage.removeItem("agh_user");
      window.dispatchEvent(new Event("agh-auth-changed"));
    }
    setUser(null);
    setProfileOpen(false);
    setMenuOpen(false);
  };

  const handleBuyPremium = async () => {
    try {
      if (!user?.id) {
        console.error("Buy Premium: missing user id");
        return;
      }

      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: String(user.id),
          userEmail: user.email,
        }),
      });

      if (!res.ok) {
        console.error("Failed to create checkout session");
        return;
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned from API");
      }
    } catch (err) {
      console.error("Buy Premium click error:", err);
    }
  };

  return (
    <>
      {/* NAVBAR */}
      <header
        className="
          fixed top-4 left-1/2 z-30 flex w-[90%] max-w-5xl -translate-x-1/2
          items-center justify-between rounded-full
          border border-slate-800/60 bg-slate-900/60
          px-5 py-3 text-sm backdrop-blur-md shadow-lg shadow-black/20
        "
      >
        {/* Brand */}
        <Link
          href="/"
          className="font-semibold text-emerald-400 hover:text-emerald-300 transition"
        >
          AsZUna&apos;s Gold Helper
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-xs text-slate-300 md:flex relative">
          <Link href="/guides" className="hover:text-emerald-400 transition">
            Guides
          </Link>
          <Link href="/about" className="hover:text-emerald-400 transition">
            About
          </Link>

          {!user && (
            <button
              onClick={openLogin}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-emerald-500 hover:text-emerald-400 transition"
            >
              Login
            </button>
          )}

          {user && !isPremiumMember && (
            <button
              onClick={handleBuyPremium}
              className="rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20 hover:border-amber-300 transition"
            >
              🧪 Buy Premium
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
                <div className="flex items-center gap-2">
                  <span>{user.username || user.email || "Profile"}</span>
                  {isPremiumMember && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/70 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
                      🧪 Premium
                    </span>
                  )}
                </div>
              </button>

              {profileOpen && (
                <div
                  className="
                    absolute right-0 mt-2 w-48 rounded-xl border border-slate-800
                    bg-slate-950/98 py-2 text-[11px] text-slate-200 shadow-xl
                  "
                >
                  {isGuideAdmin && (
                    <>
                      <Link
                        href="/admin/guides/new"
                        className="block px-3 py-1.5 hover:bg-slate-900/90 hover:text-emerald-400 transition"
                        onClick={() => setProfileOpen(false)}
                      >
                        Guide Creator
                      </Link>
                      <Link
                        href="/admin/users"
                        className="block px-3 py-1.5 hover:bg-slate-900/90 hover:text-emerald-400 transition"
                        onClick={() => setProfileOpen(false)}
                      >
                        Admin: Users &amp; Roles
                      </Link>
                      <div className="my-1 border-t border-slate-800/70" />
                    </>
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

        {/* Mobile menu button */}
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
          aria-label="Toggle navigation"
        >
          <span className="sr-only">Menu</span>
          <div className="space-y-1">
            <span className="block h-0.5 w-4 bg-current" />
            <span className="block h-0.5 w-4 bg-current" />
            <span className="block h-0.5 w-4 bg-current" />
          </div>
        </button>
      </header>

      {/* Mobile dropdown */}
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
            <Link
              href="/guides"
              className="py-1 hover:text-emerald-400 transition"
              onClick={() => setMenuOpen(false)}
            >
              Guides
            </Link>
            <Link
              href="/about"
              className="py-1 hover:text-emerald-400 transition"
              onClick={() => setMenuOpen(false)}
            >
              About
            </Link>

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
                  {isPremiumMember && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-400/70 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
                      🧪 Premium
                    </span>
                  )}
                </div>

                {!isPremiumMember && (
                  <button
                    onClick={handleBuyPremium}
                    className="w-full rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-1.5 text-left text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20 hover:border-amber-300 transition"
                  >
                    🧪 Buy Premium
                  </button>
                )}

                {isGuideAdmin && (
                  <>
                    <Link
                      href="/admin/guides/new"
                      className="w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-emerald-400 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      Guide Creator
                    </Link>
                    <Link
                      href="/admin/users"
                      className="w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-emerald-400 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      Admin: Users &amp; Roles
                    </Link>
                  </>
                )}

                <button
                  className="w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-emerald-400 transition"
                  onClick={() => {
                    // later: /profile
                    setMenuOpen(false);
                  }}
                >
                  Profile
                </button>
                <button
                  className="w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-900/90 hover:text-red-400 transition"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            )}
          </nav>
        </div>
      )}

      {/* Global auth modals */}
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
    </>
  );
}
