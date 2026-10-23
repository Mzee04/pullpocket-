import { defineChain, type Address } from "viem";

/** Arc Testnet — Studio deploys here. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" },
  },
});

/** Arc Mainnet — user deploys after Studio export. */
export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
  },
});

/**
 * Set after deploy. Empty string = demo UI (read-only until configured).
 * Prefer Vite env: VITE_CONTRACT_ADDRESS / VITE_NETWORK=testnet|mainnet
 */
const envAddress = (import.meta.env.VITE_CONTRACT_ADDRESS ?? "").trim();
const envNetwork = (import.meta.env.VITE_NETWORK ?? "testnet").toLowerCase();

export const network = envNetwork === "mainnet" ? "mainnet" : "testnet";
export const chain = network === "mainnet" ? arcMainnet : arcTestnet;
export const contractAddress = (envAddress || "") as Address | "";

/** Native Arc USDC uses 18 decimals for msg.value / eth_getBalance. */
export const USDC_DECIMALS = 18;
