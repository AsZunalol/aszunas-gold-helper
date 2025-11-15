"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface AghRole {
  name?: string;
  type?: string;
}

interface AghUser {
  id?: string | number;
  username?: string;
  email?: string;
  role?: AghRole | null;
  // Supabase-style flags (in case we ever store them directly)
  isGuideAdmin?: boolean;
  is_guide_admin?: boolean;
}

interface ProfileRow {
  id: string;
  username: string | null;
  membership_type: string | null;
  is_guide_admin: boolean | null;
}

interface GuideRow {
  id: string;
  title: string | null;
  slug?: string | null;
  is_featured?: boolean | null;
  created_at?: string | null;
}

/**
 * Same semantics as the helper on the home page:
 * - Prefer explicit flags
 * - Fallback to role name/type (e.g. "Guide Admin" / "guide-admin")
 */
function isGuideAdminUser(user: AghUser | null): boolean {
  if (!user) return false;

  // Supabase-style flags first
  if (user.isGuideAdmin === true || user.is_guide_admin === true) return true;

  // Fallback to role (old / mixed style)
  const roleName = (user.role?.name || "").toLowerCase();
  const roleType = (user.role?.type || "").toLowerCase();
  const hay = `${roleName} ${roleType}`;

  if (!hay.trim()) return false;

  if (hay.includes("guide admin") || hay.includes("guide-admin")) return true;
  if (roleName.includes("admin") && roleName.includes("guide")) return true;
  if (roleType.includes("admin") && roleType.includes("guide")) return true;

  return false;
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<AghUser | null>(null);

  // Profiles state
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);

  // Guides state
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [guidesError, setGuidesError] = useState<string | null>(null);
  const [updatingGuideId, setUpdatingGuideId] = useState<string | null>(null);
  const [deletingGuideId, setDeletingGuideId] = useState<string | null>(null);

  // 1) Check local agh_user and ensure this user is a guide admin
  useEffect(() => {
    const checkAccess = () => {
      try {
        const rawUser =
          typeof window !== "undefined"
            ? window.localStorage.getItem("agh_user")
            : null;

        if (!rawUser) {
          router.replace("/");
          return;
        }

        const parsed: AghUser = JSON.parse(rawUser);

        if (!isGuideAdminUser(parsed)) {
          router.replace("/");
          return;
        }

        setCurrentUser(parsed);
      } catch {
        router.replace("/");
      } finally {
        setChecking(false);
      }
    };

    checkAccess();
  }, [router]);

  // 2) Load all profiles (for authorized guide admins only)
  useEffect(() => {
    if (checking) return;
    if (!currentUser) return;

    const loadProfiles = async () => {
      setLoadingProfiles(true);
      setProfilesError(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, membership_type, is_guide_admin")
        .order("username", { ascending: true });

      if (error) {
        console.error("Error loading profiles:", error);
        setProfilesError(error.message || "Failed to load users.");
        setProfiles([]);
      } else {
        setProfiles((data || []) as ProfileRow[]);
      }

      setLoadingProfiles(false);
    };

    loadProfiles();
  }, [checking, currentUser]);

  // 3) Load all guides
  useEffect(() => {
    if (checking) return;
    if (!currentUser) return;

    const loadGuides = async () => {
      setLoadingGuides(true);
      setGuidesError(null);

      const { data, error } = await supabase
        .from("guides")
        .select("id, title, slug, is_featured, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading guides:", error);
        setGuidesError(error.message || "Failed to load guides.");
        setGuides([]);
      } else {
        setGuides((data || []) as GuideRow[]);
      }

      setLoadingGuides(false);
    };

    loadGuides();
  }, [checking, currentUser]);

  const handleToggleGuideAdmin = async (
    profileId: string,
    nextValue: boolean
  ) => {
    setSavingProfileId(profileId);
    setProfilesError(null);

    const { error } = await supabase
      .from("profiles")
      .update({ is_guide_admin: nextValue })
      .eq("id", profileId);

    if (error) {
      console.error("Error updating guide admin:", error);
      setProfilesError(error.message || "Failed to update guide admin flag.");
    } else {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId ? { ...p, is_guide_admin: nextValue } : p
        )
      );
    }

    setSavingProfileId(null);
  };

  const handleMembershipChange = async (
    profileId: string,
    newType: string
  ) => {
    setSavingProfileId(profileId);
    setProfilesError(null);

    const { error } = await supabase
      .from("profiles")
      .update({ membership_type: newType })
      .eq("id", profileId);

    if (error) {
      console.error("Error updating membership:", error);
      setProfilesError(error.message || "Failed to update membership type.");
    } else {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId ? { ...p, membership_type: newType } : p
        )
      );
    }

    setSavingProfileId(null);
  };

  const handleToggleFeatured = async (guideId: string, nextValue: boolean) => {
    setUpdatingGuideId(guideId);
    setGuidesError(null);

    const { error } = await supabase
      .from("guides")
      .update({ is_featured: nextValue })
      .eq("id", guideId);

    if (error) {
      console.error("Error updating guide featured flag:", error);
      setGuidesError(error.message || "Failed to update featured status.");
    } else {
      setGuides((prev) =>
        prev.map((g) =>
          g.id === guideId ? { ...g, is_featured: nextValue } : g
        )
      );
    }

    setUpdatingGuideId(null);
  };

  const handleDeleteGuide = async (guideId: string) => {
    const ok = window.confirm(
      "Are you sure you want to delete this guide? This cannot be undone."
    );
    if (!ok) return;

    setDeletingGuideId(guideId);
    setGuidesError(null);

    const { error } = await supabase
      .from("guides")
      .delete()
      .eq("id", guideId);

    if (error) {
      console.error("Error deleting guide:", error);
      setGuidesError(error.message || "Failed to delete guide.");
    } else {
      setGuides((prev) => prev.filter((g) => g.id !== guideId));
    }

    setDeletingGuideId(null);
  };

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-400">
          Checking goblin credentials…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
        {/* Header */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-emerald-400">
              Admin: Users &amp; Guides
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Manage player roles, memberships, and which guides are featured on
              the homepage.
            </p>
          </div>

          <a
            href="/"
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-400 transition"
          >
            ← Back to site
          </a>
        </header>

        {/* USERS & ROLES */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-black/30">
          <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-3 text-xs text-slate-400">
            <span>
              Users &amp; Roles •{" "}
              {loadingProfiles
                ? "Loading..."
                : `Showing ${profiles.length} profile${
                    profiles.length === 1 ? "" : "s"
                  }`}
            </span>
            {savingProfileId && (
              <span className="text-emerald-300">Saving changes…</span>
            )}
          </div>

          {profilesError && (
            <div className="border-b border-slate-800 bg-red-950/40 px-4 py-2 text-[11px] text-red-200">
              {profilesError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 text-left">Username</th>
                  <th className="px-4 py-2 text-left">Membership</th>
                  <th className="px-4 py-2 text-left">Guide Admin</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const membership = p.membership_type || "free";
                  const isAdmin = !!p.is_guide_admin;

                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-800/60 hover:bg-slate-900/80"
                    >
                      <td className="px-4 py-2 align-middle text-slate-100">
                        {p.username || (
                          <span className="italic text-slate-500">
                            (no username)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <select
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 focus:border-emerald-500 focus:outline-none"
                          value={membership}
                          onChange={(e) =>
                            handleMembershipChange(p.id, e.target.value)
                          }
                          disabled={savingProfileId === p.id}
                        >
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                          <option value="lifetime">Lifetime</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <label className="inline-flex items-center gap-2 text-[11px] text-slate-100">
                          <input
                            type="checkbox"
                            className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                            checked={isAdmin}
                            onChange={(e) =>
                              handleToggleGuideAdmin(p.id, e.target.checked)
                            }
                            disabled={savingProfileId === p.id}
                          />
                          <span>{isAdmin ? "Guide Admin" : "Regular"}</span>
                        </label>
                      </td>
                      <td className="px-4 py-2 align-middle text-right text-[11px] text-slate-500">
                        {savingProfileId === p.id ? "Saving…" : "\u00A0"}
                      </td>
                    </tr>
                  );
                })}

                {!loadingProfiles && profiles.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-xs text-slate-500"
                    >
                      No profiles found yet. Once players register, they&apos;ll
                      show up here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* GUIDES MANAGEMENT */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-black/30">
          <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-3 text-xs text-slate-400">
            <span>
              Guides •{" "}
              {loadingGuides
                ? "Loading..."
                : `Showing ${guides.length} guide${
                    guides.length === 1 ? "" : "s"
                  }`}
            </span>
            {(updatingGuideId || deletingGuideId) && (
              <span className="text-emerald-300">Applying changes…</span>
            )}
          </div>

          {guidesError && (
            <div className="border-b border-slate-800 bg-red-950/40 px-4 py-2 text-[11px] text-red-200">
              {guidesError}
            </div>
          )}

          {guides.length === 0 && !loadingGuides ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500">
              No guides found yet. Once guide admins create guides, they&apos;ll
              show up here.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {guides.map((g) => {
                const featured = !!g.is_featured;
                const createdLabel = g.created_at
                  ? new Date(g.created_at).toLocaleDateString()
                  : "Unknown date";

                const busy =
                  updatingGuideId === g.id || deletingGuideId === g.id;

                return (
                  <article
                    key={g.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium text-slate-100">
                          {g.title || "(Untitled guide)"}
                        </h2>
                        {featured && (
                          <span className="rounded-full border border-amber-400/60 bg-amber-500/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {g.slug && (
                          <span className="mr-2 text-slate-400">
                            /guides/{g.slug}
                          </span>
                        )}
                        <span>Created: {createdLabel}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <button
                        className={`rounded-full border px-3 py-1 transition ${
                          featured
                            ? "border-slate-700 text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
                            : "border-emerald-500 text-emerald-300 hover:bg-emerald-500/10"
                        }`}
                        disabled={busy}
                        onClick={() =>
                          handleToggleFeatured(g.id, !featured)
                        }
                      >
                        {featured
                          ? "Remove from homepage"
                          : "Feature on homepage"}
                      </button>

                      <button
                        className="rounded-full border border-red-500/70 px-3 py-1 text-red-300 hover:bg-red-600/10 transition"
                        disabled={busy}
                        onClick={() => handleDeleteGuide(g.id)}
                      >
                        {deletingGuideId === g.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
