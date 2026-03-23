import { Router } from "express";
import { analyzeShopifyStore, getShopifyProducts } from "../tools/shopify.js";
const router = Router();
router.get("/shopify/analyze", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
        res.status(400).json({
            error: "Missing required query parameter: url",
            example: "/shopify/analyze?url=example.myshopify.com",
        });
        return;
    }
    try {
        const result = await analyzeShopifyStore(url);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(503).json({
            error: "Failed to analyze Shopify store",
            detail: message,
            store_url: url,
        });
    }
});
router.get("/shopify/products", async (req, res) => {
    const { url, page, limit } = req.query;
    if (!url || typeof url !== "string") {
        res.status(400).json({
            error: "Missing required query parameter: url",
            example: "/shopify/products?url=example.myshopify.com&page=1&limit=50",
        });
        return;
    }
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    if (isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({ error: "page must be a positive integer" });
        return;
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 250) {
        res.status(400).json({ error: "limit must be between 1 and 250" });
        return;
    }
    try {
        const result = await getShopifyProducts(url, pageNum, limitNum);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(503).json({
            error: "Failed to fetch Shopify products",
            detail: message,
            store_url: url,
        });
    }
});
export default router;
//# sourceMappingURL=shopify.js.map