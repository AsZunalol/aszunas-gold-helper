import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

let stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    console.error(
      "[Stripe] STRIPE_SECRET_KEY is not set. Webhook will not work."
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

function json(data: any, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("[Stripe] Webhook missing signature header");
    return json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
    return json(
      { error: "Stripe is not configured on the server" },
      { status: 500 }
    );
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
    console.error(
      "Stripe webhook signature verification failed:",
      err?.message
    );
    return json(
      { error: `Webhook error: ${err?.message || "Invalid signature"}` },
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

        // TODO: Update Supabase profile membership_type here

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

        // TODO: membership_type = "premium" when sub.status === "active"

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log("❌ Subscription cancelled", {
          id: sub.id,
          status: sub.status,
          customer: sub.customer,
        });

        // TODO: downgrade membership_type to "free"

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
