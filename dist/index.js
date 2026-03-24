import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createX402Middleware } from "./x402middleware.js";
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
    process.exit(1);
}
const BASE_NETWORK = process.env.NETWORK ?? "eip155:84532";
const CDP_KEY_ID = process.env.CDP_API_KEY_ID;
const CDP_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
// Request logging
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
app.use(express.json());
// ─── Free endpoints ───────────────────────────────────────────────────────────
app.use(healthRouter);
app.use("/.well-known", express.static(path.join(__dirname, "..", ".well-known")));
app.get("/openapi.json", (_req, res) => res.json({ openapi: "3.0.0", info: { title: "rothy Intelligence API", version: "1.0.0" } }));
// ─── x402 Payment Middleware ──────────────────────────────────────────────────
const x402 = createX402Middleware({
    walletAddress: WALLET_ADDRESS,
    network: BASE_NETWORK,
    cdpKeyId: CDP_KEY_ID,
    cdpKeySecret: CDP_KEY_SECRET,
    routes: {
        "GET /shopify/analyze": { price: "$0.08", description: "Analyze any Shopify store - products, pricing, apps, theme" },
        "GET /shopify/products": { price: "$0.02", description: "Paginated product catalog from any Shopify store" },
        "GET /amazon/search": { price: "$0.05", description: "Search Amazon products with Opportunity Score" },
        "GET /amazon/product": { price: "$0.08", description: "Analyze single Amazon product with FBA profitability estimate" },
        "GET /maps/search": { price: "$0.05", description: "Search Google Maps businesses with Lead Quality Score" },
        "GET /maps/leads": { price: "$0.10", description: "Find sales leads with outreach hints and quality filtering" },
    },
});
app.use(x402);
// ─── Paid routes ──────────────────────────────────────────────────────────────
app.use(shopifyRouter);
app.use(amazonRouter);
app.use(mapsRouter);
// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
});
app.listen(PORT, () => {
    const useCdp = !!(CDP_KEY_ID && CDP_KEY_SECRET);
    console.log(`\n🚀 Intelligence API running on port ${PORT}`);
    console.log(`   Wallet:      ${WALLET_ADDRESS}`);
    console.log(`   Network:     ${BASE_NETWORK}`);
    console.log(`   Facilitator: ${useCdp ? "CDP (Base Mainnet)" : "x402.org (Sepolia)"}`);
    console.log(`   Payment:     x402 / USDC\n`);
});
//# sourceMappingURL=index.js.map