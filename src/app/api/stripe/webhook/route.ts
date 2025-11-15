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
    console.error("[Stripe] STRIPE_SECRET_KEY is not set. Webhook will not work.");
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
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL not set. Cannot update membership."
    );
    return null;
  }

  supabaseAdmin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  return supabaseAdmin;
}

function json(data: any, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    console.error("[Stripe] Webhook missing signature header");
    return json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error(
      "[Stripe] STRIPE_WEBHOOK_SECRET is not set. Webhook cannot verify events."
    );
    return json(
      { error: "Stripe webhook is not configured on the server" },
      { status: 500 }
    );
  }

  const stripeClient = getStripe();
  if (!stripeClient) {
    return json({ error: "Stripe is not configured on the server" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();

    event = stripeClient.webhooks.constructEvent(
      rawBody,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err?.message);
    return json(
      { error: `Webhook error: ${err?.message || "Invalid signature"}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Prefer explicit metadata from our checkout, else fallback
        const email =
          (session.metadata?.user_email as string | undefined) ||
          session.customer_email ||
          undefined;

        let stripeCustomerId: string | null = null;
        if (typeof session.customer === "string") {
          stripeCustomerId = session.customer;
        } else if (session.customer && typeof session.customer === "object") {
          stripeCustomerId = (session.customer as Stripe.Customer).id;
        }

        console.log("✅ checkout.session.completed", {
          email,
          stripeCustomerId,
          sessionId: session.id,
        });

        if (email && supabase) {
          const updatePayload: Record<string, any> = {
            membership_type: "premium",
          };

          if (stripeCustomerId) {
            updatePayload.stripe_customer_id = stripeCustomerId;
          }

          const { error } = await supabase
            .from("profiles")
            .update(updatePayload)
            .eq("email", email);

          if (error) {
            console.error(
              "[Supabase] Failed to update membership_type/stripe_customer_id for email",
              email,
              error
            );
          } else {
            console.log(
              "[Supabase] membership_type='premium' updated for",
              email,
              "stripe_customer_id=",
              stripeCustomerId
            );
          }
        } else if (!email) {
          console.warn(
            "[Webhook] No email found in session to update membership_type"
          );
        }

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("🔁 Subscription updated", {
          id: sub.id,
          status: sub.status,
          customer: sub.customer,
        });

        // Optional: keep membership_type in sync here too if you want.
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("❌ Subscription cancelled", {
          id: sub.id,
          status: sub.status,
          customer: sub.customer,
        });

        // OPTIONAL: auto-downgrade membership_type to 'free' here.
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook handler error:", err);
    return json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
