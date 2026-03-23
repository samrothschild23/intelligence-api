import { Router } from "express";
import { ENDPOINT_PRICES } from "../utils/pricing.js";
const router = Router();
router.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        payment_protocol: "x402",
        network: "base",
        endpoints: Object.entries(ENDPOINT_PRICES).map(([route, config]) => ({
            route,
            price_usd: config.price,
            description: config.description,
        })),
        free_endpoints: [
            "/health",
            "/.well-known/mcp.json",
            "/.well-known/ai-plugin.json",
            "/openapi.json",
        ],
    });
});
export default router;
//# sourceMappingURL=health.js.map