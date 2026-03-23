# rothy Intelligence API

An x402-powered intelligence API for Shopify, Amazon, and Google Maps data. AI agents pay per call in USDC on Base — no signup, no API keys, no human in the loop.

## What This Does

| Tool | What It Returns | Price |
|------|----------------|-------|
| `GET /shopify/analyze` | Products, pricing, apps, theme, collections for any Shopify store | $0.08 |
| `GET /shopify/products` | Paginated product catalog from any Shopify store | $0.02 |
| `GET /amazon/search` | Amazon search results with Opportunity Score | $0.05 |
| `GET /amazon/product` | Single ASIN analysis with FBA profitability estimate | $0.08 |
| `GET /maps/search` | Google Maps business search with Lead Quality Score | $0.05 |
| `GET /maps/leads` | Qualified sales leads with outreach hints | $0.10 |

Free endpoints: `GET /health`, `GET /.well-known/mcp.json`, `GET /openapi.json`

---

## How x402 Payment Works

x402 is a protocol for machine-native micropayments using HTTP 402. No accounts, no rate-limit keys, no billing — agents pay per call in USDC on Base.

**Flow:**

```
Agent → GET /shopify/analyze?url=example.myshopify.com
Server → 402 Payment Required
         X-PAYMENT-REQUIRED: {"price": "$0.08", "network": "base", ...}

Agent → signs USDC TransferWithAuthorization (ERC-3009)
Agent → GET /shopify/analyze?url=example.myshopify.com
        X-PAYMENT: <signed-payment-header>

Server → verifies payment on Base
Server → 200 OK + intelligence data
```

Agents need a funded Base wallet with USDC. USDC settles directly to the server wallet — no intermediary, no escrow.

---

## Endpoints

### GET /shopify/analyze

Analyzes a Shopify store: product catalog, pricing distribution, top vendors, product types, detected apps (Klaviyo, Yotpo, ReCharge, etc.), theme detection.

**Query params:**
- `url` (required) — store URL, e.g. `example.myshopify.com`

**Example:**
```bash
curl "https://api.example.com/shopify/analyze?url=gymshark.com" \
  -H "X-PAYMENT: <signed-payment>"
```

**Response:**
```json
{
  "store_url": "https://gymshark.com",
  "store_name": "Gymshark",
  "product_count": 342,
  "collection_count": 28,
  "price_range": { "min": 18.00, "max": 65.00, "avg": 38.50 },
  "top_vendors": [{ "vendor": "Gymshark", "count": 342 }],
  "has_sale_items": true,
  "sale_percentage": 23,
  "detected_apps": ["Klaviyo", "Yotpo", "Sezzle"],
  "detected_theme": "Dawn",
  "analyzed_at": "2026-03-22T10:00:00Z"
}
```

---

### GET /shopify/products

Paginated product catalog. Pages up to 250 products per call.

**Query params:**
- `url` (required)
- `page` (optional, default: 1)
- `limit` (optional, default: 50, max: 250)

---

### GET /amazon/search

Searches Amazon products and returns an **Opportunity Score** (0–100) for each. High score = strong demand + quality gap + good price tier.

**Query params:**
- `keyword` (required)
- `marketplace` (optional: `US` | `UK` | `DE` | `CA` | `AU`, default: `US`)

**Example:**
```bash
curl "https://api.example.com/amazon/search?keyword=yoga+mat&marketplace=US" \
  -H "X-PAYMENT: <signed-payment>"
```

**Response:**
```json
{
  "keyword": "yoga mat",
  "marketplace": "US",
  "total_results": 24,
  "products": [
    {
      "asin": "B08N5WRWNW",
      "title": "Premium Yoga Mat Non Slip...",
      "price": 28.99,
      "rating": 4.3,
      "review_count": 12453,
      "prime": true,
      "opportunity_score": 72,
      "url": "https://www.amazon.com/dp/B08N5WRWNW"
    }
  ]
}
```

**Opportunity Score formula:**
- Reviews >1000 (proven demand): +15
- Rating <4.0 (quality gap to fill): +8–15
- Price $15–$60 (mass market sweet spot): +10
- Prime eligible: +5

---

### GET /amazon/product

Deep analysis of a single ASIN including FBA fee/profit estimates.

**Query params:**
- `asin` (required) — 10-character Amazon product ID
- `marketplace` (optional, default: `US`)

**Response includes FBA estimate:**
```json
{
  "asin": "B08N5WRWNW",
  "fba_estimate": {
    "estimated_monthly_sales": 400,
    "estimated_monthly_revenue": 11596,
    "estimated_fba_fee": 9.84,
    "estimated_profit_margin": 28,
    "opportunity_tier": "medium"
  }
}
```

---

### GET /maps/search

Searches Google Maps businesses and scores each as a sales lead.

**Query params:**
- `query` (required) — business type, e.g. `coffee shops`
- `location` (required) — city/area, e.g. `Austin TX`
- `max` (optional, default: 20, max: 60)
- `google_key` (required) — your Google Places API key

**Response includes Lead Quality Score:**
```json
{
  "businesses": [
    {
      "name": "Brew & Co Coffee",
      "rating": 3.8,
      "website": null,
      "phone": "+1-512-555-0100",
      "lead_quality_score": 68,
      "outreach_hints": [
        "No website detected — pitch web presence / digital marketing",
        "Low rating (3.8) — pitch reputation management or review improvement"
      ]
    }
  ]
}
```

**Lead Quality Score formula:**
- Has website: +20
- Has phone: +10
- Rating <4.0: +8–15
- Reviews >50: +10–15
- Price level ≥2: +10
- Business OPERATIONAL: +10

---

### GET /maps/leads

Returns only businesses above a quality score threshold, sorted by score. Best for building targeted outreach lists.

**Query params:**
- `industry` (required)
- `location` (required)
- `min_score` (optional, default: 60)
- `google_key` (required)

---

## Getting a Google Places API Key

Maps endpoints require your own Google Places API key (the server never stores it):

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. Enable **Places API**
4. Create an API key under **APIs & Services → Credentials**
5. Pass it as `?google_key=YOUR_KEY` on every Maps request

---

## Agent Discovery

### x402scan

Agents discover x402-enabled APIs via [x402scan](https://x402scan.io). The server returns proper x402 headers on every 402 response.

### MCP Discovery

```
GET /.well-known/mcp.json
```

Returns the MCP plugin manifest pointing to the OpenAPI spec at `/openapi.json`.

### OpenAI Plugin Discovery

```
GET /.well-known/ai-plugin.json
```

Compatible with ChatGPT plugin discovery format.

---

## Running the Server

### Setup

```bash
npm install
cp .env.example .env
# Edit .env: set WALLET_ADDRESS to your Base USDC wallet
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Environment Variables

```
WALLET_ADDRESS=0x...   # Your USDC-receiving wallet on Base (required)
PORT=3000              # Default: 3000
NODE_ENV=production
```

---

## x402 Payment Flow (Technical)

When an agent makes a request without payment:

```
HTTP/1.1 402 Payment Required
X-PAYMENT-REQUIRED: {
  "version": "1",
  "price": "$0.08",
  "network": "base",
  "payTo": "0xYourWalletAddress",
  "asset": "USDC"
}
```

The agent:
1. Signs a `TransferWithAuthorization` (ERC-3009) for the USDC amount
2. Retries with `X-PAYMENT: <base64-encoded-signed-authorization>`
3. Server verifies the signature on-chain and serves the response

USDC settles atomically to `WALLET_ADDRESS` on Base mainnet.

---

## Error Responses

All errors return JSON:

```json
{
  "error": "Human-readable error message",
  "detail": "Technical detail (optional)",
  "retry_after": 30
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — check query params |
| 402 | Payment required — send x402 payment header |
| 503 | Upstream rate limited (Amazon) — retry after 30s |
| 502 | Upstream error (scraping failed) |
