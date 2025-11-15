import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

let stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    console.error(
      "[Stripe] STRIPE_SECRET_KEY is not set. Checkout API will not work."
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

export async function POST(req: NextRequest) {
  try {
    const stripeClient = getStripe();

    if (!stripeClient) {
      return NextResponse.json(
        { error: "Stripe is not configured on the server" },
        { status: 500 }
      );
    }

    // Try to read JSON body, but don't crash if empty
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    // Priority: 1) body.priceId, 2) server env, 3) public env
    const envPriceId =
      process.env.STRIPE_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

    const priceId: string | undefined =
      body?.priceId && typeof body.priceId === "string"
        ? body.priceId
        : envPriceId;

    if (!priceId) {
      console.error(
        "[Stripe] No priceId provided and STRIPE_PRICE_ID / NEXT_PUBLIC_STRIPE_PRICE_ID not set."
      );
      return NextResponse.json(
        {
          error:
            "No priceId provided. Set STRIPE_PRICE_ID in your env or send { priceId } in the request body.",
        },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/membership/success`,
      cancel_url: `${baseUrl}/membership/cancel`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: err?.message || "Stripe error" },
      { status: 500 }
    );
  }
}
