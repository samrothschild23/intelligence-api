export interface ShopifyProduct {
    id: number;
    title: string;
    handle: string;
    vendor: string;
    product_type: string;
    tags: string[];
    variants: {
        id: number;
        title: string;
        price: string;
        compare_at_price: string | null;
        sku: string;
        available: boolean;
        inventory_quantity?: number;
    }[];
    images: {
        src: string;
    }[];
    created_at: string;
    updated_at: string;
}
export interface ShopifyCollection {
    id: number;
    handle: string;
    title: string;
    products_count: number;
}
export interface ShopifyAnalysis {
    store_url: string;
    store_name: string;
    product_count: number;
    collection_count: number;
    price_range: {
        min: number;
        max: number;
        avg: number;
    };
    top_vendors: {
        vendor: string;
        count: number;
    }[];
    top_product_types: {
        type: string;
        count: number;
    }[];
    has_sale_items: boolean;
    sale_percentage: number;
    detected_apps: string[];
    detected_theme: string;
    collections: ShopifyCollection[];
    sample_products: ShopifyProduct[];
    analyzed_at: string;
}
export interface ShopifyProductsResult {
    store_url: string;
    page: number;
    limit: number;
    total_fetched: number;
    products: ShopifyProduct[];
}
export declare function analyzeShopifyStore(storeUrl: string): Promise<ShopifyAnalysis>;
export declare function getShopifyProducts(storeUrl: string, page?: number, limit?: number): Promise<ShopifyProductsResult>;
//# sourceMappingURL=shopify.d.ts.map