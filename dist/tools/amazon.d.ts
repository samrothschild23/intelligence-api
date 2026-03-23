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
export declare function searchAmazon(keyword: string, marketplace?: string): Promise<AmazonSearchResult>;
export declare function getAmazonProduct(asin: string, marketplace?: string): Promise<AmazonProductDetail>;
//# sourceMappingURL=amazon.d.ts.map