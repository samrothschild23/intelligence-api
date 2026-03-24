/**
 * Lightweight x402 payment middleware for CDP Base Mainnet.
 *
 * Bypasses the @x402/express SDK's facilitator validation step entirely.
 * Implements the x402 protocol directly:
 * 1. No payment header → 402 with payment instructions
 * 2. Payment header present → verify with CDP facilitator → allow or reject
 */
import type { Request, Response, NextFunction } from "express";
interface RouteConfig {
    price: string;
    description: string;
}
interface X402Config {
    walletAddress: string;
    network: string;
    routes: Record<string, RouteConfig>;
    cdpKeyId?: string;
    cdpKeySecret?: string;
    facilitatorUrl?: string;
}
export declare function createX402Middleware(config: X402Config): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=x402middleware.d.ts.map