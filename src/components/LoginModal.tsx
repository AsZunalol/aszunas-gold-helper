"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onOpenRegister: () => void;
}

interface AghRole {
  name?: string;
  type?: string;
}

interface AghUser {
  username?: string;
  email?: string;
  role?: AghRole;
  membershipType?: string;
}

export function LoginModal({ open, onClose, onOpenRegister }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  const resetStateAndClose = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Supabase sign-in
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        console.error("Supabase signIn error:", signInError);
        setError(signInError.message || "Failed to log in.");
        setSubmitting(false);
        return;
      }

      const user = data.user;
      if (!user) {
        setError("Login seems to have worked, but no user returned.");
        setSubmitting(false);
        return;
      }

      // 2) Fetch or create profile
      let usernameFromProfile: string | undefined = undefined;
      let membershipType: string | undefined = "free";
      let isGuideAdmin = false;

      // Try to select existing profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username, membership_type, is_guide_admin")
        .eq("id", user.id)
        .single();

      if (!profileError && profile) {
        usernameFromProfile = profile.username || undefined;
        membershipType = profile.membership_type || "free";
        isGuideAdmin = !!profile.is_guide_admin;
      } else {
        // If no profile exists (e.g. migrated old users), create one on the fly
        const fallbackUsername =
          usernameFromProfile ||
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "Player";

        const { error: insertProfileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            username: fallbackUsername,
            membership_type: "free",
            is_guide_admin: false,
          });

        if (insertProfileError) {
          console.error("Supabase auto profile insert error:", insertProfileError);
        }

        usernameFromProfile = fallbackUsername;
        membershipType = "free";
        isGuideAdmin = false;
      }

      const localUser: AghUser = {
        username:
          usernameFromProfile ||
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          undefined,
        email: user.email || undefined,
        membershipType,
        role: {
          name: isGuideAdmin ? "Guide Admin" : "Supabase User",
          type: isGuideAdmin ? "guide-admin" : "supabase-user",
        },
      };

      // 3) Store in localStorage and broadcast auth change
      if (typeof window !== "undefined") {
        window.localStorage.setItem("agh_user", JSON.stringify(localUser));
        // We are not using Strapi anymore, so remove the old token
        window.localStorage.removeItem("agh_token");
        window.dispatchEvent(new Event("agh-auth-changed"));
      }

      setSuccess("Logged in successfully.");
      setSubmitting(false);

      setTimeout(() => {
        resetStateAndClose();
      }, 600);
    } catch (err: any) {
      console.error("Unexpected login error:", err);
      setError("Unexpected error while logging in.");
      setSubmitting(false);
    }
  };

  const handleSwitchToRegister = () => {
    setError(null);
    setSuccess(null);
    onClose();
    onOpenRegister();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950/95 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-emerald-400">
            Log in to AsZUna&apos;s Gold Helper
          </h2>
          <button
            onClick={resetStateAndClose}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-[11px] text-slate-400">
          Welcome back, goblin. Time to squeeze more gold out of Azeroth.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 text-[11px]">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
              placeholder="Your secret goblin key"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-[10px] text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-200">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div className="mt-4 text-[10px] text-slate-500">
          No account yet?{" "}
          <button
            type="button"
            onClick={handleSwitchToRegister}
            className="text-emerald-400 hover:text-emerald-300"
          >
            Create one
          </button>
        </div>
      </div>
    </div>
  );
}
