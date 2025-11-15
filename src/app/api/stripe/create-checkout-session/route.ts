import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY env var");
}
if (!premiumPriceId) {
  throw new Error("Missing STRIPE_PREMIUM_PRICE_ID env var");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20", // or latest available
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, userEmail } = body as {
      userId?: string;
      userEmail?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: userEmail, // optional; Stripe will create or reuse customer
      line_items: [
        {
          price: premiumPriceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/guides?upgraded=1`,
      cancel_url: `${siteUrl}/guides?upgrade_cancelled=1`,
      metadata: {
        user_id: userId,
        purpose: "premium_membership",
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          purpose: "premium_membership",
        },
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("Stripe create-checkout-session error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
