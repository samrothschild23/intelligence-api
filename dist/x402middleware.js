/**
 * Lightweight x402 payment middleware for CDP Base Mainnet.
 *
 * Bypasses the @x402/express SDK's facilitator validation step entirely.
 * Implements the x402 protocol directly:
 * 1. No payment header → 402 with payment instructions
 * 2. Payment header present → verify with CDP facilitator → allow or reject
 */
import { createPrivateKey, createSign, randomUUID } from "crypto";
// ─── CDP JWT ──────────────────────────────────────────────────────────────────
function buildCdpJwt(keyId, keySecret, requestPath) {
    const raw = Buffer.from(keySecret, "base64");
    let privateKeyObj;
    try {
        if (raw.length === 32) {
            // Raw seed bytes → wrap in PKCS8
            const pkcs8 = Buffer.concat([
                Buffer.from("302e020100300506032b657004220420", "hex"),
                raw,
            ]);
            privateKeyObj = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
        }
        else {
            privateKeyObj = createPrivateKey({ key: raw, format: "der", type: "pkcs8" });
        }
    }
    catch {
        privateKeyObj = createPrivateKey({ key: `-----BEGIN PRIVATE KEY-----\n${keySecret}\n-----END PRIVATE KEY-----`, format: "pem" });
    }
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: keyId })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        sub: keyId,
        iss: "cdp",
        nbf: now,
        exp: now + 60,
        uri: requestPath,
        nonce: randomUUID().replace(/-/g, ""),
    })).toString("base64url");
    const sign = createSign("ed25519");
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(privateKeyObj).toString("base64url");
    return `${header}.${payload}.${signature}`;
}
// ─── Price parser ─────────────────────────────────────────────────────────────
function priceToAtomicUnits(price) {
    // "$0.08" → 80000 (USDC has 6 decimals)
    const num = parseFloat(price.replace("$", ""));
    return BigInt(Math.round(num * 1_000_000));
}
// ─── USDC contract addresses ──────────────────────────────────────────────────
const USDC_ADDRESSES = {
    "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base Mainnet
    "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
};
// ─── Middleware factory ───────────────────────────────────────────────────────
export function createX402Middleware(config) {
    const { walletAddress, network, routes, cdpKeyId, cdpKeySecret, facilitatorUrl = "https://x402.org/facilitator", } = config;
    const useCdp = !!(cdpKeyId && cdpKeySecret);
    const usdcAddress = USDC_ADDRESSES[network] ?? USDC_ADDRESSES["eip155:84532"];
    function getRouteConfig(method, path) {
        const key = `${method.toUpperCase()} ${path}`;
        return routes[key] ?? null;
    }
    function build402Response(routeConfig, requestPath) {
        const atomicAmount = priceToAtomicUnits(routeConfig.price);
        return {
            x402Version: 1,
            error: "X-PAYMENT header is required",
            accepts: [{
                    scheme: "exact",
                    network,
                    maxAmountRequired: atomicAmount.toString(),
                    resource: requestPath,
                    description: routeConfig.description,
                    mimeType: "application/json",
                    payTo: walletAddress,
                    maxTimeoutSeconds: 300,
                    asset: usdcAddress,
                    outputSchema: null,
                    extra: null,
                }],
        };
    }
    async function verifyWithFacilitator(paymentHeader, resource) {
        try {
            const verifyUrl = `${useCdp ? "https://api.cdp.coinbase.com/platform/v2/x402" : facilitatorUrl}/verify`;
            const headers = {
                "Content-Type": "application/json",
            };
            if (useCdp && cdpKeyId && cdpKeySecret) {
                headers["Authorization"] = `Bearer ${buildCdpJwt(cdpKeyId, cdpKeySecret, `platform/v2/x402/verify`)}`;
            }
            const response = await fetch(verifyUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    x402Version: 1,
                    paymentHeader,
                    resource,
                }),
                signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok) {
                const text = await response.text();
                console.error(`[x402] Facilitator verify failed: ${response.status} ${text}`);
                return false;
            }
            const result = await response.json();
            return result.isValid === true;
        }
        catch (err) {
            console.error("[x402] Facilitator verify error:", err);
            return false;
        }
    }
    return async function x402Middleware(req, res, next) {
        const routeConfig = getRouteConfig(req.method, req.path);
        // Not a paid route — pass through
        if (!routeConfig) {
            return next();
        }
        const paymentHeader = req.headers["x-payment"];
        // No payment — return 402
        if (!paymentHeader) {
            res.status(402).json(build402Response(routeConfig, req.path));
            return;
        }
        // Verify payment
        const resource = `${req.protocol}://${req.get("host")}${req.path}`;
        const isValid = await verifyWithFacilitator(paymentHeader, resource);
        if (!isValid) {
            res.status(402).json({
                ...build402Response(routeConfig, req.path),
                error: "Payment verification failed",
            });
            return;
        }
        // Payment valid — proceed
        next();
    };
}
//# sourceMappingURL=x402middleware.js.map