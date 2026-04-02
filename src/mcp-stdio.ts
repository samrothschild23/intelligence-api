/**
 * mcp-stdio.ts
 *
 * Stdio MCP server for Glama inspection and local use.
 * Exposes all 6 intelligence tools over JSON-RPC stdin/stdout.
 *
 * Usage:
 *   node dist/mcp-stdio.js
 *
 * Required env vars:
 *   GOOGLE_API_KEY  — for Maps tools (optional; Maps tools fail gracefully without it)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { analyzeShopifyStore, getShopifyProducts } from "./tools/shopify.js";
import { searchAmazon, getAmazonProduct } from "./tools/amazon.js";
import { searchMapsBusinesses, findSalesLeads } from "./tools/maps.js";

const server = new Server(
  { name: "intelligence-api", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool definitions ────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "shopify_analyze",
      description:
        "Analyze any Shopify store — products, pricing distribution, top vendors, detected apps (Klaviyo, Yotpo, etc.), theme, and collections.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Shopify store URL, e.g. gymshark.com",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "shopify_products",
      description:
        "Fetch a paginated product catalog from any Shopify store. Up to 250 products per call.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Shopify store URL",
          },
          page: {
            type: "number",
            description: "Page number (default: 1)",
          },
          limit: {
            type: "number",
            description: "Products per page, max 250 (default: 50)",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "amazon_search",
      description:
        "Search Amazon products by keyword. Returns an Opportunity Score (0–100) for each result based on demand, rating gap, and price.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "Search keyword, e.g. 'yoga mat'",
          },
          marketplace: {
            type: "string",
            description: "Marketplace: US, UK, DE, CA, AU (default: US)",
            enum: ["US", "UK", "DE", "CA", "AU"],
          },
        },
        required: ["keyword"],
      },
    },
    {
      name: "amazon_product",
      description:
        "Deep analysis of a single Amazon product by ASIN. Includes FBA fee estimate, profit margin, and opportunity tier.",
      inputSchema: {
        type: "object",
        properties: {
          asin: {
            type: "string",
            description: "10-character Amazon ASIN, e.g. B08N5WRWNW",
          },
          marketplace: {
            type: "string",
            description: "Marketplace: US, UK, DE, CA, AU (default: US)",
            enum: ["US", "UK", "DE", "CA", "AU"],
          },
        },
        required: ["asin"],
      },
    },
    {
      name: "maps_search",
      description:
        "Search Google Maps businesses by type and location. Returns each business with a Lead Quality Score (0–100) and outreach hints.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Business type or search query, e.g. 'coffee shops'",
          },
          location: {
            type: "string",
            description: "City or area, e.g. 'Austin TX'",
          },
          max: {
            type: "number",
            description: "Max results, up to 60 (default: 20)",
          },
          google_key: {
            type: "string",
            description: "Your Google Places API key",
          },
        },
        required: ["query", "location", "google_key"],
      },
    },
    {
      name: "maps_leads",
      description:
        "Find qualified sales leads on Google Maps filtered by Lead Quality Score. Best for building targeted outreach lists.",
      inputSchema: {
        type: "object",
        properties: {
          industry: {
            type: "string",
            description: "Industry or business type, e.g. 'restaurants'",
          },
          location: {
            type: "string",
            description: "City or area, e.g. 'Miami FL'",
          },
          min_score: {
            type: "number",
            description: "Minimum Lead Quality Score threshold (default: 60)",
          },
          google_key: {
            type: "string",
            description: "Your Google Places API key",
          },
        },
        required: ["industry", "location", "google_key"],
      },
    },
  ],
}));

// ─── Tool call handler ───────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "shopify_analyze": {
        const { url } = args as { url: string };
        result = await analyzeShopifyStore(url);
        break;
      }
      case "shopify_products": {
        const { url, page, limit } = args as {
          url: string;
          page?: number;
          limit?: number;
        };
        result = await getShopifyProducts(url, page, limit);
        break;
      }
      case "amazon_search": {
        const { keyword, marketplace } = args as {
          keyword: string;
          marketplace?: string;
        };
        result = await searchAmazon(keyword, marketplace);
        break;
      }
      case "amazon_product": {
        const { asin, marketplace } = args as {
          asin: string;
          marketplace?: string;
        };
        result = await getAmazonProduct(asin, marketplace);
        break;
      }
      case "maps_search": {
        const { query, location, max, google_key } = args as {
          query: string;
          location: string;
          max?: number;
          google_key: string;
        };
        result = await searchMapsBusinesses(query, location, google_key, max);
        break;
      }
      case "maps_leads": {
        const { industry, location, min_score, google_key } = args as {
          industry: string;
          location: string;
          min_score?: number;
          google_key: string;
        };
        result = await findSalesLeads(industry, location, google_key, min_score);
        break;
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
