export interface PlaceBusiness {
    place_id: string;
    name: string;
    address: string;
    phone: string | null;
    website: string | null;
    rating: number | null;
    user_ratings_total: number | null;
    types: string[];
    lat: number;
    lng: number;
    business_status: string;
    price_level: number | null;
    lead_quality_score: number;
    outreach_hints: string[];
}
export interface MapsSearchResult {
    query: string;
    location: string;
    total_results: number;
    businesses: PlaceBusiness[];
    searched_at: string;
}
export interface MapsLeadsResult {
    industry: string;
    location: string;
    min_score: number;
    total_qualified: number;
    leads: PlaceBusiness[];
    searched_at: string;
}
export declare function searchMapsBusinesses(query: string, location: string, apiKey: string, max?: number): Promise<MapsSearchResult>;
export declare function findSalesLeads(industry: string, location: string, apiKey: string, minScore?: number): Promise<MapsLeadsResult>;
//# sourceMappingURL=maps.d.ts.map