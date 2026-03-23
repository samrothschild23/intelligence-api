export const ENDPOINT_PRICES: Record<string, { price: string; description: string }> = {
  "GET /shopify/analyze": {
    price: "$0.08",
    description: "Analyze any Shopify store - products, pricing, apps, theme",
  },
  "GET /shopify/products": {
    price: "$0.02",
    description: "Paginated product catalog from any Shopify store",
  },
  "GET /amazon/search": {
    price: "$0.05",
    description: "Search Amazon products with Opportunity Score",
  },
  "GET /amazon/product": {
    price: "$0.08",
    description: "Analyze single Amazon product with FBA profitability estimate",
  },
  "GET /maps/search": {
    price: "$0.05",
    description: "Search Google Maps businesses with Lead Quality Score",
  },
  "GET /maps/leads": {
    price: "$0.10",
    description: "Find sales leads with outreach hints and quality filtering",
  },
};
