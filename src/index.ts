import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import healthRouter from "./routes/health.js";
import shopifyRouter from "./routes/shopify.js";
import amazonRouter from "./routes/amazon.js";
import mapsRouter from "./routes/maps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

if (!WALLET_ADDRESS) {
  console.error("ERROR: WALLET_ADDRESS environment variable is required.");
  console.error("Set it in your .env file to your Base USDC-receiving wallet address.");
  process.exit(1);
}

// Network: defaults to Base Sepolia (eip155:84532) which works with the default x402.org facilitator.
// Set NETWORK=eip155:8453 for Base Mainnet (requires a facilitator that supports it).
const BASE_NETWORK = (process.env.NETWORK ?? "eip155:84532") as Network;

/**
 * x402 route configuration.
 * Each key matches "METHOD /path" and defines the payment requirement.
 * Agents that call these routes without payment get HTTP 402 + payment instructions.
 * Agents that include a valid x402 payment header get the response.
 */
const ROUTES = {
  "GET /shopify/analyze": {
    accepts: {
      scheme: "exact",
      network: BASE_NETWORK,
      payTo: WALLET_ADDRESS,
      price: "$0.08",
    },
    description: "Analyze any Shopify store - products, pricing, apps, theme",
    mimeType: "application/json",
  },
  "GET /shopify/products": {
    accepts: {
      scheme: "exact",
      network: BASE_NETWORK,
      payTo: WALLET_ADDRESS,
      price: "$0.02",
    },
    description: "Paginated product catalog from any Shopify store",
    mimeType: "application/json",
  },
  "GET /amazon/search": {
    accepts: {
      scheme: "exact",
      network: BASE_NETWORK,
      payTo: WALLET_ADDRESS,
      price: "$0.05",
    },
    description: "Search Amazon products with Opportunity Score",
    mimeType: "application/json",
  },
  "GET /amazon/product": {
    accepts: {
      scheme: "exact",
      network: BASE_NETWORK,
      payTo: WALLET_ADDRESS,
      price: "$0.08",
    },
    description:
      "Analyze single Amazon product with FBA profitability estimate",
    mimeType: "application/json",
  },
  "GET /maps/search": {
    accepts: {
      scheme: "exact",
      network: BASE_NETWORK,
      payTo: WALLET_ADDRESS,
      price: "$0.05",
    },
    description: "Search Google Maps businesses with Lead Quality Score",
    mimeType: "application/json",
  },
  "GET /maps/leads": {
    accepts: {
      scheme: "exact",
      network: BASE_NETWORK,
      payTo: WALLET_ADDRESS,
      price: "$0.10",
    },
    description: "Find sales leads with outreach hints and quality filtering",
    mimeType: "application/json",
  },
};

// ─── Request logging ────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Free endpoints (served before payment middleware) ───────────────────────
app.use(healthRouter);

// Serve .well-known as static files
app.use(
  "/.well-known",
  express.static(path.join(__dirname, "..", ".well-known"))
);

// OpenAPI spec
app.get("/openapi.json", (_req, res) => {
  res.json(buildOpenAPISpec());
});

// ─── x402 Payment Middleware ─────────────────────────────────────────────────
// paymentMiddlewareFromConfig registers the EVM scheme and creates the resource server.
// Routes not in ROUTES pass through freely (health, discovery, openapi).
const facilitatorUrl = process.env.FACILITATOR_URL; // undefined → default x402.org/facilitator
const facilitator = facilitatorUrl
  ? new HTTPFacilitatorClient({ url: facilitatorUrl })
  : new HTTPFacilitatorClient();

app.use(
  paymentMiddlewareFromConfig(
    ROUTES,
    facilitator,
    [{ network: BASE_NETWORK, server: new ExactEvmScheme() }]
  )
);

// ─── Paid routes ──────────────────────────────────────────────────────────────
app.use(shopifyRouter);
app.use(amazonRouter);
app.use(mapsRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Intelligence API running on port ${PORT}`);
  console.log(`   Wallet: ${WALLET_ADDRESS}`);
  console.log(`   Network: ${BASE_NETWORK}`);
  console.log(`   Facilitator: ${facilitatorUrl ?? "https://x402.org/facilitator"}`);
  console.log(`   Payment protocol: x402 / USDC`);
  console.log(`\n   Paid endpoints:`);
  for (const [route, config] of Object.entries(ROUTES)) {
    const price = Array.isArray(config.accepts)
      ? config.accepts[0].price
      : config.accepts.price;
    console.log(`   ${String(price).padEnd(6)} ${route}`);
  }
  console.log(`\n   Health:    http://localhost:${PORT}/health`);
  console.log(`   Discovery: http://localhost:${PORT}/.well-known/mcp.json`);
  console.log(`   OpenAPI:   http://localhost:${PORT}/openapi.json\n`);
});

// ─── OpenAPI spec builder ─────────────────────────────────────────────────────
function buildOpenAPISpec() {
  return {
    openapi: "3.0.0",
    info: {
      title: "rothy Intelligence API",
      version: "1.0.0",
      description:
        "E-commerce and business intelligence API. Analyze Shopify stores, Amazon products, and find sales leads from Google Maps. All endpoints require x402 USDC micropayment on Base.",
    },
    servers: [{ url: "/" }],
    paths: {
      "/shopify/analyze": {
        get: {
          summary: "Analyze a Shopify store",
          description:
            "Returns products, collections, pricing stats, detected apps and theme. **$0.08 USDC via x402**",
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Shopify store URL (e.g., example.myshopify.com)",
            },
          ],
          responses: {
            "200": { description: "Store analysis" },
            "402": { description: "Payment required (x402)" },
            "400": { description: "Missing or invalid parameters" },
            "503": { description: "Store unreachable or rate limited" },
          },
        },
      },
      "/shopify/products": {
        get: {
          summary: "Get paginated product catalog",
          description:
            "Returns paginated products from any Shopify store. **$0.02 USDC via x402**",
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "page",
              in: "query",
              required: false,
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 50, minimum: 1, maximum: 250 },
            },
          ],
          responses: {
            "200": { description: "Product list" },
            "402": { description: "Payment required (x402)" },
          },
        },
      },
      "/amazon/search": {
        get: {
          summary: "Search Amazon products",
          description:
            "Search Amazon for products with Opportunity Score. **$0.05 USDC via x402**",
          parameters: [
            {
              name: "keyword",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "marketplace",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["US", "UK", "DE", "CA", "AU"],
                default: "US",
              },
            },
          ],
          responses: {
            "200": { description: "Search results with opportunity scores" },
            "402": { description: "Payment required (x402)" },
            "503": { description: "Amazon rate limited — retry in 30s" },
          },
        },
      },
      "/amazon/product": {
        get: {
          summary: "Analyze Amazon product by ASIN",
          description:
            "Full product analysis with FBA profitability estimate. **$0.08 USDC via x402**",
          parameters: [
            {
              name: "asin",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "marketplace",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["US", "UK", "DE", "CA", "AU"],
                default: "US",
              },
            },
          ],
          responses: {
            "200": { description: "Product detail with FBA estimate" },
            "402": { description: "Payment required (x402)" },
          },
        },
      },
      "/maps/search": {
        get: {
          summary: "Search Google Maps businesses",
          description:
            "Business search with Lead Quality Score. Requires your Google Places API key. **$0.05 USDC via x402**",
          parameters: [
            {
              name: "query",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "location",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "max",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20, minimum: 1, maximum: 60 },
            },
            {
              name: "google_key",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Business list with lead quality scores" },
            "402": { description: "Payment required (x402)" },
          },
        },
      },
      "/maps/leads": {
        get: {
          summary: "Find qualified sales leads",
          description:
            "Returns leads above a quality score threshold with outreach hints. **$0.10 USDC via x402**",
          parameters: [
            {
              name: "industry",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "location",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "min_score",
              in: "query",
              required: false,
              schema: { type: "integer", default: 60, minimum: 0, maximum: 100 },
            },
            {
              name: "google_key",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Qualified leads with outreach hints" },
            "402": { description: "Payment required (x402)" },
          },
        },
      },
    },
  };
}
