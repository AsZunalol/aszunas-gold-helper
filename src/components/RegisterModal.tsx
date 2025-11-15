"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
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

export function RegisterModal({ open, onClose, onOpenLogin }: RegisterModalProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  const resetStateAndClose = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password || !username) {
      setError("Please fill in username, email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Supabase sign up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        console.error("Supabase signUp error:", signUpError);
        setError(signUpError.message || "Failed to register.");
        setSubmitting(false);
        return;
      }

      const user = data.user;
      if (!user) {
        setError("Registration worked, but no user returned. Try logging in.");
        setSubmitting(false);
        return;
      }

      // 2) Create profile row
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        username,
        membership_type: "free",
        is_guide_admin: false,
      });

      if (profileError) {
        console.error("Supabase profile insert error:", profileError);
        // Not fatal for auth, but we tell the user
      }

      // 3) Store a simple agh_user in localStorage so navbar can pick it up
      const localUser: AghUser = {
        username,
        email,
        role: {
          name: "Supabase User",
          type: "supabase-user",
        },
        membershipType: "free",
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem("agh_user", JSON.stringify(localUser));
        // We’re not using Strapi anymore, so make sure old token is gone
        window.localStorage.removeItem("agh_token");
        // Tell the rest of the app that auth changed
        window.dispatchEvent(new Event("agh-auth-changed"));
      }

      setSuccess("Account created! You are now logged in.");
      setSubmitting(false);

      // Small delay so user can see the success text, then close
      setTimeout(() => {
        resetStateAndClose();
      }, 700);
    } catch (err: any) {
      console.error("Unexpected register error:", err);
      setError("Unexpected error while registering.");
      setSubmitting(false);
    }
  };

  const handleSwitchToLogin = () => {
    setError(null);
    setSuccess(null);
    onClose();
    onOpenLogin();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950/95 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-emerald-400">
            Create AsZUna&apos;s Gold Helper account
          </h2>
          <button
            onClick={resetStateAndClose}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-[11px] text-slate-400">
          Sign up to access free guides now and premium goblin magic later.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 text-[11px]">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
              placeholder="GoblinMaster"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-400">
                Confirm
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
                placeholder="Repeat password"
              />
            </div>
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
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-[10px] text-slate-500">
          Already have an account?{" "}
          <button
            type="button"
            onClick={handleSwitchToLogin}
            className="text-emerald-400 hover:text-emerald-300"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
