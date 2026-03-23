import { Router } from "express";
import { searchMapsBusinesses, findSalesLeads } from "../tools/maps.js";
const router = Router();
router.get("/maps/search", async (req, res) => {
    const { query, location, max, google_key } = req.query;
    if (!query || typeof query !== "string") {
        res.status(400).json({
            error: "Missing required query parameter: query",
            example: "/maps/search?query=coffee+shops&location=Austin+TX&google_key=YOUR_KEY",
        });
        return;
    }
    if (!location || typeof location !== "string") {
        res.status(400).json({
            error: "Missing required query parameter: location",
            example: "/maps/search?query=coffee+shops&location=Austin+TX&google_key=YOUR_KEY",
        });
        return;
    }
    if (!google_key || typeof google_key !== "string") {
        res.status(400).json({
            error: "Missing required query parameter: google_key",
            detail: "Provide your Google Places API key. Get one at https://console.cloud.google.com",
        });
        return;
    }
    const maxNum = max ? parseInt(max, 10) : 20;
    if (isNaN(maxNum) || maxNum < 1 || maxNum > 60) {
        res.status(400).json({ error: "max must be between 1 and 60" });
        return;
    }
    try {
        const result = await searchMapsBusinesses(query, location, google_key, maxNum);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const status = message.includes("API status:") ? 400 : 503;
        res.status(status).json({
            error: "Google Maps search failed",
            detail: message,
        });
    }
});
router.get("/maps/leads", async (req, res) => {
    const { industry, location, min_score, google_key } = req.query;
    if (!industry || typeof industry !== "string") {
        res.status(400).json({
            error: "Missing required query parameter: industry",
            example: "/maps/leads?industry=plumbers&location=Denver+CO&min_score=60&google_key=YOUR_KEY",
        });
        return;
    }
    if (!location || typeof location !== "string") {
        res.status(400).json({
            error: "Missing required query parameter: location",
            example: "/maps/leads?industry=plumbers&location=Denver+CO&min_score=60&google_key=YOUR_KEY",
        });
        return;
    }
    if (!google_key || typeof google_key !== "string") {
        res.status(400).json({
            error: "Missing required query parameter: google_key",
            detail: "Provide your Google Places API key. Get one at https://console.cloud.google.com",
        });
        return;
    }
    const minScoreNum = min_score ? parseInt(min_score, 10) : 60;
    if (isNaN(minScoreNum) || minScoreNum < 0 || minScoreNum > 100) {
        res.status(400).json({ error: "min_score must be between 0 and 100" });
        return;
    }
    try {
        const result = await findSalesLeads(industry, location, google_key, minScoreNum);
        res.json(result);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const status = message.includes("API status:") ? 400 : 503;
        res.status(status).json({
            error: "Google Maps leads search failed",
            detail: message,
        });
    }
});
export default router;
//# sourceMappingURL=maps.js.map