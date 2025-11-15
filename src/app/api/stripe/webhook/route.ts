import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY env var");
}
if (!webhookSecret) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET env var");
}
if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var");
}
if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
}

// Stripe client (server-side)
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20", // or latest available in your project
});

// Supabase admin client (server-side, uses service role key)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    // For Next.js App Router, req.text() gives the raw body string
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature error:", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.metadata as any)?.user_id;

        if (userId) {
          // Checkout completed — usually means subscription is created (or will be)
          await updateMembership(userId, "premium");
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = (subscription.metadata as any)?.user_id;
        if (!userId) break;

        const status = subscription.status;

        if (status === "active" || status === "trialing") {
          await updateMembership(userId, "premium");
        } else if (
          status === "canceled" ||
          status === "unpaid" ||
          status === "incomplete_expired" ||
          status === "past_due"
        ) {
          await updateMembership(userId, "free");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = (subscription.metadata as any)?.user_id;
        if (!userId) break;

        await updateMembership(userId, "free");
        break;
      }

      default:
        // Ignore other events
        break;
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}

async function updateMembership(userId: string, membershipType: string) {
  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ membership_type: membershipType })
      .eq("id", userId);

    if (error) {
      console.error(
        `Supabase membership update error for ${userId} -> ${membershipType}:`,
        error
      );
    } else {
      console.log(
        `Updated membership_type for ${userId} -> ${membershipType}`
      );
    }
  } catch (err) {
    console.error("Unexpected error updating membership:", err);
  }
}
