# Dodo Payments Setup

Costra supports [Dodo Payments](https://dodopayments.com) as a payment provider for subscriptions. When configured, Dodo is used instead of Stripe for checkout.

## Prerequisites

1. [Dodo Payments account](https://app.dodopayments.com)
2. Products created in Dodo Dashboard (Starter Monthly, Starter Annual, Pro Monthly, Pro Annual)

## Environment Variables

Add to your `.env`:

```bash
# Dodo Payments (optional - when set, Dodo is used instead of Stripe)
DODO_PAYMENTS_API_KEY=your_api_key_from_dashboard
DODO_PAYMENTS_WEBHOOK_KEY=your_webhook_secret_from_dashboard
DODO_PAYMENTS_ENVIRONMENT=test_mode   # or live_mode for production

# Product IDs - create products in Dodo Dashboard, then copy IDs here
DODO_STARTER_MONTHLY_PRODUCT_ID=prod_xxx
DODO_STARTER_ANNUAL_PRODUCT_ID=prod_xxx
DODO_PRO_MONTHLY_PRODUCT_ID=prod_xxx
DODO_PRO_ANNUAL_PRODUCT_ID=prod_xxx
```

## Dashboard Setup

1. **Get API Key**  
   Dodo Dashboard → Developer → API → Create/Copy API Key

2. **Create Products**  
   Create subscription products for each plan × billing period:
   - Starter (Monthly)
   - Starter (Annual)
   - Pro (Monthly)
   - Pro (Annual)

3. **Configure Webhook**  
   - Go to Settings → Webhooks → Add Webhook  
   - URL: `https://your-domain.com/api/billing/dodo-webhook`  
   - Subscribe to: `payment.succeeded`, `subscription.created`, `subscription.activated`, `subscription.cancelled`, `subscription.expired`  
   - Copy the Webhook Secret Key → `DODO_PAYMENTS_WEBHOOK_KEY`

## Flow

- **Checkout**: User upgrades → backend creates Dodo checkout session → user is redirected to Dodo-hosted checkout
- **Success**: User completes payment → Dodo sends webhook → backend upgrades subscription in DB
- **Manage billing**: Dodo has no customer portal; users manage via Dodo Dashboard or contact support

## Stripe Fallback

If `DODO_PAYMENTS_API_KEY` is not set, Costra falls back to Stripe (when `STRIPE_SECRET_KEY` is set). Use one or the other, not both for the same deployment.
