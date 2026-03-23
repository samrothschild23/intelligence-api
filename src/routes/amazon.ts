import { Router, Request, Response } from "express";
import { searchAmazon, getAmazonProduct } from "../tools/amazon.js";

const router = Router();

const VALID_MARKETPLACES = ["US", "UK", "DE", "CA", "AU"];

router.get("/amazon/search", async (req: Request, res: Response) => {
  const { keyword, marketplace = "US" } = req.query;

  if (!keyword || typeof keyword !== "string") {
    res.status(400).json({
      error: "Missing required query parameter: keyword",
      example: "/amazon/search?keyword=yoga+mat&marketplace=US",
    });
    return;
  }

  const mkt = (marketplace as string).toUpperCase();
  if (!VALID_MARKETPLACES.includes(mkt)) {
    res.status(400).json({
      error: `Invalid marketplace. Must be one of: ${VALID_MARKETPLACES.join(", ")}`,
    });
    return;
  }

  try {
    const result = await searchAmazon(keyword, mkt);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("rate limited") ? 503 : 502;
    res.status(status).json({
      error: "Amazon search failed",
      detail: message,
      retry_after: message.includes("rate limited") ? 30 : undefined,
    });
  }
});

router.get("/amazon/product", async (req: Request, res: Response) => {
  const { asin, marketplace = "US" } = req.query;

  if (!asin || typeof asin !== "string") {
    res.status(400).json({
      error: "Missing required query parameter: asin",
      example: "/amazon/product?asin=B08N5WRWNW&marketplace=US",
    });
    return;
  }

  const cleanAsin = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(cleanAsin)) {
    res.status(400).json({
      error: "Invalid ASIN format. Must be 10 alphanumeric characters.",
      example: "B08N5WRWNW",
    });
    return;
  }

  const mkt = (marketplace as string).toUpperCase();
  if (!VALID_MARKETPLACES.includes(mkt)) {
    res.status(400).json({
      error: `Invalid marketplace. Must be one of: ${VALID_MARKETPLACES.join(", ")}`,
    });
    return;
  }

  try {
    const result = await getAmazonProduct(cleanAsin, mkt);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("rate limited") ? 503 : 502;
    res.status(status).json({
      error: "Amazon product fetch failed",
      detail: message,
      retry_after: message.includes("rate limited") ? 30 : undefined,
    });
  }
});

export default router;
