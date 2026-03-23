import * as cheerio from "cheerio";

export interface AmazonProduct {
  asin: string;
  title: string;
  price: number | null;
  original_price: number | null;
  rating: number | null;
  review_count: number | null;
  seller: string;
  prime: boolean;
  badge: string | null;
  image_url: string | null;
  url: string;
  opportunity_score: number;
}

export interface AmazonSearchResult {
  keyword: string;
  marketplace: string;
  total_results: number;
  products: AmazonProduct[];
  searched_at: string;
}

export interface AmazonProductDetail extends AmazonProduct {
  description: string;
  bullet_points: string[];
  category: string;
  rank_in_category: number | null;
  dimensions: string | null;
  weight: string | null;
  fba_estimate: FBAEstimate;
  analyzed_at: string;
}

export interface FBAEstimate {
  estimated_monthly_sales: number;
  estimated_monthly_revenue: number;
  estimated_fba_fee: number;
  estimated_profit_margin: number;
  opportunity_tier: "low" | "medium" | "high";
}

const MARKETPLACE_DOMAINS: Record<string, string> = {
  US: "www.amazon.com",
  UK: "www.amazon.co.uk",
  DE: "www.amazon.de",
  CA: "www.amazon.ca",
  AU: "www.amazon.com.au",
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

/**
 * Opportunity Score (0–100):
 * - High reviews (demand signal) → higher score
 * - Low rating (quality gap) → higher score
 * - Lower price (mass market) → slightly higher score
 * - BSR rank penalty not available on search, so we weight reviews + rating
 */
function calculateOpportunityScore(product: {
  review_count: number | null;
  rating: number | null;
  price: number | null;
  prime: boolean;
}): number {
  let score = 50; // base

  // Review count (demand)
  const reviews = product.review_count ?? 0;
  if (reviews > 10000) score += 20;
  else if (reviews > 1000) score += 15;
  else if (reviews > 100) score += 10;
  else if (reviews > 10) score += 5;
  else score -= 5; // untested market

  // Rating (quality gap — lower rating = more room to win)
  const rating = product.rating ?? 4.0;
  if (rating < 3.5) score += 15;
  else if (rating < 4.0) score += 8;
  else if (rating >= 4.5) score -= 5;

  // Price sweet spot ($15–$60)
  const price = product.price ?? 0;
  if (price >= 15 && price <= 60) score += 10;
  else if (price > 60) score += 5;
  else score -= 5;

  // Prime availability (easier fulfillment)
  if (product.prime) score += 5;

  return Math.max(0, Math.min(100, score));
}

function parsePrice(text: string | undefined | null): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

function parseReviewCount(text: string | undefined | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[,\s]/g, "").replace(/\(|\)/g, "");
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export async function searchAmazon(
  keyword: string,
  marketplace: string = "US"
): Promise<AmazonSearchResult> {
  const domain = MARKETPLACE_DOMAINS[marketplace.toUpperCase()] ?? MARKETPLACE_DOMAINS.US;
  const url = `https://${domain}/s?k=${encodeURIComponent(keyword)}`;

  const res = await fetch(url, { headers: HEADERS });

  if (res.status === 503 || res.status === 429) {
    throw new Error("Amazon rate limited — retry in 30s");
  }

  if (!res.ok) {
    throw new Error(`Amazon search failed: HTTP ${res.status}`);
  }

  const html = await res.text();

  // Detect CAPTCHA / robot check
  if (html.includes("Type the characters you see") || html.includes("robot check")) {
    throw new Error("Amazon rate limited — retry in 30s");
  }

  const $ = cheerio.load(html);
  const products: AmazonProduct[] = [];

  $('[data-component-type="s-search-result"]').each((_, el) => {
    const $el = $(el);
    const asin = $el.attr("data-asin") ?? "";
    if (!asin) return;

    const title = $el.find("h2 a span").first().text().trim();
    const priceWhole = $el.find(".a-price-whole").first().text().trim();
    const priceFraction = $el.find(".a-price-fraction").first().text().trim();
    const priceStr = priceWhole ? `${priceWhole}${priceFraction || "00"}` : null;
    const price = parsePrice(priceStr);

    const originalPriceStr = $el.find(".a-text-price .a-offscreen").first().text().trim();
    const original_price = parsePrice(originalPriceStr);

    const ratingStr = $el.find(".a-icon-alt").first().text().trim();
    const rating = ratingStr ? parseFloat(ratingStr) : null;

    const reviewStr = $el.find('[aria-label*="ratings"] span, .a-size-base.puis-normal-weight-text').first().text().trim();
    const review_count = parseReviewCount(reviewStr);

    const seller = $el.find(".a-size-base-plus.a-color-base.s-underline-text").first().text().trim() || "Amazon";
    const prime = $el.find(".s-prime").length > 0;
    const badge = $el.find(".a-badge-text").first().text().trim() || null;
    const image_url = $el.find(".s-image").first().attr("src") ?? null;

    const opportunity_score = calculateOpportunityScore({ review_count, rating, price, prime });

    products.push({
      asin,
      title,
      price,
      original_price,
      rating,
      review_count,
      seller,
      prime,
      badge,
      image_url,
      url: `https://${domain}/dp/${asin}`,
      opportunity_score,
    });
  });

  return {
    keyword,
    marketplace: marketplace.toUpperCase(),
    total_results: products.length,
    products,
    searched_at: new Date().toISOString(),
  };
}

function estimateFBA(
  price: number | null,
  rating: number | null,
  reviewCount: number | null
): FBAEstimate {
  const p = price ?? 25;
  const reviews = reviewCount ?? 0;

  // Rough BSR-to-sales estimate (without actual BSR, proxy via reviews)
  const estimatedMonthlySales =
    reviews > 5000 ? 800
    : reviews > 1000 ? 400
    : reviews > 100 ? 150
    : reviews > 10 ? 50
    : 10;

  const estimatedMonthlyRevenue = Math.round(p * estimatedMonthlySales);

  // FBA fee estimate: typically 15% referral + $3–8 fulfillment
  const referralFee = p * 0.15;
  const fulfillmentFee = p < 10 ? 3.0 : p < 20 ? 4.5 : p < 40 ? 5.5 : 7.5;
  const estimatedFbaFee = Math.round((referralFee + fulfillmentFee) * 100) / 100;

  // Assume COGS ~35% of price (standard private label)
  const cogs = p * 0.35;
  const profit = p - estimatedFbaFee - cogs;
  const profitMargin = Math.round((profit / p) * 100);

  const tier: FBAEstimate["opportunity_tier"] =
    profitMargin > 30 ? "high"
    : profitMargin > 15 ? "medium"
    : "low";

  return {
    estimated_monthly_sales: estimatedMonthlySales,
    estimated_monthly_revenue: estimatedMonthlyRevenue,
    estimated_fba_fee: estimatedFbaFee,
    estimated_profit_margin: profitMargin,
    opportunity_tier: tier,
  };
}

export async function getAmazonProduct(
  asin: string,
  marketplace: string = "US"
): Promise<AmazonProductDetail> {
  const domain = MARKETPLACE_DOMAINS[marketplace.toUpperCase()] ?? MARKETPLACE_DOMAINS.US;
  const url = `https://${domain}/dp/${asin}`;

  const res = await fetch(url, { headers: HEADERS });

  if (res.status === 503 || res.status === 429) {
    throw new Error("Amazon rate limited — retry in 30s");
  }

  if (!res.ok) {
    throw new Error(`Amazon product fetch failed: HTTP ${res.status}`);
  }

  const html = await res.text();

  if (html.includes("Type the characters you see") || html.includes("robot check")) {
    throw new Error("Amazon rate limited — retry in 30s");
  }

  const $ = cheerio.load(html);

  const title = $("#productTitle").text().trim();
  const priceStr = $(".a-price .a-offscreen").first().text().trim();
  const price = parsePrice(priceStr);

  const originalPriceStr = $(".a-text-price .a-offscreen").first().text().trim();
  const original_price = parsePrice(originalPriceStr);

  const ratingStr = $(".reviewCountTextLinkedHistogram").attr("title") ??
    $("#acrPopover").attr("title") ?? "";
  const rating = ratingStr ? parseFloat(ratingStr) : null;

  const reviewCountStr = $("#acrCustomerReviewText").first().text().trim();
  const review_count = parseReviewCount(reviewCountStr);

  const seller = $("#sellerProfileTriggerId").text().trim() ||
    $("#merchant-info a").first().text().trim() ||
    "Amazon";

  const prime = $("#isPrimeBadge").length > 0 || $(".a-icon-prime").length > 0;

  const image_url = $("#landingImage").attr("src") ??
    $("#imgBlkFront").attr("src") ?? null;

  const description = $("#productDescription p").text().trim() ||
    $("#aplus .aplus-module p").first().text().trim();

  const bullet_points: string[] = [];
  $("#feature-bullets li span.a-list-item").each((_, el) => {
    const text = $(el).text().trim();
    if (text) bullet_points.push(text);
  });

  const category = $(".a-breadcrumb .a-link-normal").last().text().trim();

  const rankText = $("#SalesRank").text().trim() ||
    $(".a-text-bold:contains('Best Sellers Rank')").next().text().trim();
  const rankMatch = rankText.match(/#([\d,]+)/);
  const rank_in_category = rankMatch
    ? parseInt(rankMatch[1].replace(/,/g, ""), 10)
    : null;

  const dimensions = $("th:contains('Product Dimensions')").next().text().trim() || null;
  const weight = $("th:contains('Item Weight')").next().text().trim() || null;

  const opportunity_score = calculateOpportunityScore({ review_count, rating, price, prime });
  const fba_estimate = estimateFBA(price, rating, review_count);

  return {
    asin,
    title,
    price,
    original_price,
    rating,
    review_count,
    seller,
    prime,
    badge: null,
    image_url,
    url,
    opportunity_score,
    description,
    bullet_points,
    category,
    rank_in_category,
    dimensions,
    weight,
    fba_estimate,
    analyzed_at: new Date().toISOString(),
  };
}
