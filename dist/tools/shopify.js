import * as cheerio from "cheerio";
function normalizeStoreUrl(url) {
    let normalized = url.trim().toLowerCase();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
        normalized = "https://" + normalized;
    }
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, "");
    return normalized;
}
const APP_SIGNATURES = {
    "Klaviyo": ["klaviyo"],
    "Yotpo": ["yotpo"],
    "Privy": ["privy"],
    "Hotjar": ["hotjar"],
    "Gorgias": ["gorgias"],
    "ReCharge": ["recharge"],
    "Bold Commerce": ["boldcommerce", "boldapps"],
    "Loox": ["loox"],
    "Okendo": ["okendo"],
    "Smile.io": ["smile.io", "lion-apps"],
    "Sezzle": ["sezzle"],
    "Afterpay": ["afterpay"],
    "Klarna": ["klarna"],
    "Judge.me": ["judge.me"],
    "Stamped.io": ["stamped.io"],
    "Omnisend": ["omnisend"],
    "SMSBump": ["smsbump"],
};
function detectApps(html) {
    const detected = [];
    const lower = html.toLowerCase();
    for (const [app, signatures] of Object.entries(APP_SIGNATURES)) {
        if (signatures.some((sig) => lower.includes(sig))) {
            detected.push(app);
        }
    }
    return detected;
}
function detectTheme(html) {
    const $ = cheerio.load(html);
    // Common theme meta or comments
    const themeComment = html.match(/Shopify Theme: ([^\n]+)/i);
    if (themeComment)
        return themeComment[1].trim();
    // Check for theme stylesheet link
    const themeLink = $('link[rel="stylesheet"][href*="/assets/"]').attr("href");
    if (themeLink) {
        const match = themeLink.match(/\/assets\/([a-z0-9-_]+)\.css/i);
        if (match)
            return match[1];
    }
    // Common known themes
    if (html.includes("Dawn"))
        return "Dawn";
    if (html.includes("Debut"))
        return "Debut";
    if (html.includes("Brooklyn"))
        return "Brooklyn";
    if (html.includes("Minimal"))
        return "Minimal";
    if (html.includes("Narrative"))
        return "Narrative";
    return "Unknown";
}
export async function analyzeShopifyStore(storeUrl) {
    const baseUrl = normalizeStoreUrl(storeUrl);
    const headers = {
        "User-Agent": "Mozilla/5.0 (compatible; IntelligenceAPI/1.0; +https://intelligence-api.io)",
        Accept: "application/json",
    };
    // Fetch products, collections, and homepage in parallel
    const [productsRes, collectionsRes, homepageRes] = await Promise.allSettled([
        fetch(`${baseUrl}/products.json?limit=250`, { headers }),
        fetch(`${baseUrl}/collections.json?limit=250`, { headers }),
        fetch(baseUrl, {
            headers: { ...headers, Accept: "text/html" },
        }),
    ]);
    let products = [];
    let collections = [];
    let homepageHtml = "";
    if (productsRes.status === "fulfilled" && productsRes.value.ok) {
        const json = (await productsRes.value.json());
        products = json.products ?? [];
    }
    if (collectionsRes.status === "fulfilled" && collectionsRes.value.ok) {
        const json = (await collectionsRes.value.json());
        collections = json.collections ?? [];
    }
    if (homepageRes.status === "fulfilled" && homepageRes.value.ok) {
        homepageHtml = await homepageRes.value.text();
    }
    // Compute pricing stats
    const allPrices = [];
    let saleCount = 0;
    for (const product of products) {
        for (const variant of product.variants) {
            const price = parseFloat(variant.price);
            if (!isNaN(price) && price > 0)
                allPrices.push(price);
            if (variant.compare_at_price && parseFloat(variant.compare_at_price) > price) {
                saleCount++;
            }
        }
    }
    const priceRange = {
        min: allPrices.length ? Math.min(...allPrices) : 0,
        max: allPrices.length ? Math.max(...allPrices) : 0,
        avg: allPrices.length
            ? Math.round((allPrices.reduce((a, b) => a + b, 0) / allPrices.length) * 100) / 100
            : 0,
    };
    // Vendor aggregation
    const vendorCounts = {};
    for (const p of products) {
        if (p.vendor)
            vendorCounts[p.vendor] = (vendorCounts[p.vendor] ?? 0) + 1;
    }
    const topVendors = Object.entries(vendorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([vendor, count]) => ({ vendor, count }));
    // Product type aggregation
    const typeCounts = {};
    for (const p of products) {
        if (p.product_type)
            typeCounts[p.product_type] = (typeCounts[p.product_type] ?? 0) + 1;
    }
    const topProductTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }));
    // Store name from homepage
    let storeName = baseUrl.replace(/^https?:\/\//, "").split(".")[0];
    if (homepageHtml) {
        const $ = cheerio.load(homepageHtml);
        const titleEl = $("title").first().text().trim();
        if (titleEl)
            storeName = titleEl.split(/[|\-–]/)[0].trim();
    }
    return {
        store_url: baseUrl,
        store_name: storeName,
        product_count: products.length,
        collection_count: collections.length,
        price_range: priceRange,
        top_vendors: topVendors,
        top_product_types: topProductTypes,
        has_sale_items: saleCount > 0,
        sale_percentage: products.length > 0
            ? Math.round((saleCount / products.length) * 100)
            : 0,
        detected_apps: homepageHtml ? detectApps(homepageHtml) : [],
        detected_theme: homepageHtml ? detectTheme(homepageHtml) : "Unknown",
        collections: collections.slice(0, 20),
        sample_products: products.slice(0, 10),
        analyzed_at: new Date().toISOString(),
    };
}
export async function getShopifyProducts(storeUrl, page = 1, limit = 50) {
    const baseUrl = normalizeStoreUrl(storeUrl);
    const clampedLimit = Math.min(Math.max(1, limit), 250);
    const headers = {
        "User-Agent": "Mozilla/5.0 (compatible; IntelligenceAPI/1.0; +https://intelligence-api.io)",
        Accept: "application/json",
    };
    const res = await fetch(`${baseUrl}/products.json?limit=${clampedLimit}&page=${page}`, { headers });
    if (!res.ok) {
        throw new Error(`Failed to fetch products from ${baseUrl}: HTTP ${res.status}`);
    }
    const json = (await res.json());
    const products = json.products ?? [];
    return {
        store_url: baseUrl,
        page,
        limit: clampedLimit,
        total_fetched: products.length,
        products,
    };
}
//# sourceMappingURL=shopify.js.map