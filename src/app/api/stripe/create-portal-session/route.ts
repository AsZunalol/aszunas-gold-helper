import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  createClient as createSupabaseClient,
  SupabaseClient,
} from "@supabase/supabase-js";

let stripe: Stripe | null = null;
let supabaseAdmin: SupabaseClient | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    console.error(
      "[Stripe] STRIPE_SECRET_KEY is not set. Customer portal will not work."
    );
    return null;
  }

  if (!stripe) {
    stripe = new Stripe(key, {
      apiVersion: "2025-10-29.clover",
    });
  }

  return stripe;
}

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL not set. Cannot read profiles."
    );
    return null;
  }

  supabaseAdmin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  return supabaseAdmin;
}

export async function POST(req: NextRequest) {
  try {
    const stripeClient = getStripe();
    const supabase = getSupabaseAdmin();

    if (!stripeClient || !supabase) {
      return NextResponse.json(
        { error: "Server is not configured for Stripe/Supabase" },
        { status: 500 }
      );
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    const email =
      body?.email && typeof body.email === "string" ? body.email : null;

    if (!email) {
      return NextResponse.json(
        { error: "Missing email in request body" },
        { status: 400 }
      );
    }

    // Look up profile to find stripe_customer_id
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("[Supabase] Error fetching profile for portal:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    if (!profile || !profile.stripe_customer_id) {
      console.error(
        "[Portal] No stripe_customer_id stored for email:",
        email
      );
      return NextResponse.json(
        {
          error:
            "No Stripe customer found for this account. Did you purchase with the same email?",
        },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/membership`, // where to send user back after managing
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("Stripe portal error:", err);
    return NextResponse.json(
      { error: err?.message || "Portal error" },
      { status: 500 }
    );
  }
}
