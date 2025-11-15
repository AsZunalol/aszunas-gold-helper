import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

if (!stripeWebhookSecret) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable");
}

// Stripe client (server-side)
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
});

// Helper to send JSON easily
function json(
  data: any,
  init?: { status?: number }
): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("Stripe webhook missing signature header");
    return json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      stripeWebhookSecret
    );
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return json(
      { error: `Webhook error: ${err.message || "Invalid signature"}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("✅ Checkout session completed", {
          id: session.id,
          customer: session.customer,
          customer_email: session.customer_email,
          metadata: session.metadata,
        });

        // TODO: Here is where you update Supabase `profiles.membership_type`
        // using metadata (e.g. session.metadata.user_id) or customer_email.
        // This is left as a TODO so build doesn't break if your schema differs.

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("🔁 Subscription updated", {
          id: sub.id,
          status: sub.status,
          customer: sub.customer,
        });

        // TODO: Flip membership_type = "premium" when status === "active",
        // and downgrade when "canceled" / "past_due" / etc.

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("❌ Subscription cancelled", {
          id: sub.id,
          status: sub.status,
          customer: sub.customer,
        });

        // TODO: Downgrade membership_type to "free" in Supabase.

        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook handler error:", err);
    return json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
