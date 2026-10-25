# PullPocket — Arc MAINNET deploy + proof tx

**Deadline:** Monday 2 November 2026, 05:59 Africa/Lagos (UTC+1)  
**Repo:** [https://github.com/Mzee04/pullpocket-](https://github.com/Mzee04/pullpocket-)  
**Studio (testnet done):** https://studio.arc.io/app/c96255b8-c2ce-4cfb-8bc1-62044935dabc  
**Testnet contract:** `0x8c44e5f6d41bca94ec596773e3bde2ec0a290f99`  
**Testnet Open:** https://explorer.testnet.arc.io/tx/0x8da71fa78b0d0f4037985132c544f7ca5294648b3fcc7eac0065b1ef53a7e1ef

Studio deploys **testnet only**. Mainnet is your shell + wallet.  
**Never paste a private key into chat, Studio, Discord, or this Project.** Keys live only in your local shell env.

---

## Official Arc mainnet facts (cite these)

| Item | Value | Source |
| --- | --- | --- |
| Chain ID | `5042` | [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) · [RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints) |
| Primary RPC (HTTP) | `https://rpc.mainnet.arc.io` | same |
| Primary RPC (WS) | `wss://rpc.mainnet.arc.io` | [RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints) |
| Alt RPCs | Alchemy, Blockdaemon, dRPC, QuickNode URLs on that page | same |
| Explorer | https://explorer.arc.io | same |
| Gas tracker | https://explorer.arc.io/gas-tracker | same |
| Native gas token | USDC, **18 decimals** (`eth_getBalance` / `msg.value`) | [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees) · [Contract addresses](https://docs.arc.io/arc/references/contract-addresses) |
| Optional ERC-20 view | `0x3600000000000000000000000000000000000000` (**6 decimals**, same balance) | [Contract addresses](https://docs.arc.io/arc/references/contract-addresses) |
| Mempool floor | `maxFeePerGas` ≥ **20 gwei** | [Gas and fees](https://docs.arc.io/arc/references/gas-and-fees) |
| CCTP domain | `26` | [Contract addresses](https://docs.arc.io/arc/references/contract-addresses) · [CCTP bridging](https://docs.arc.io/integrate/exchanges/cctp-bridging) |

PullPocket uses **native** USDC only (`msg.value`, 18 decimals). Do not `approve` / `transferFrom` the ERC-20 view for the tab.

---

## How to get USDC on Arc mainnet (official only)

There is **no public mainnet faucet**. [RPC troubleshooting](https://docs.arc.io/arc/references/rpc-endpoints) says: for mainnet gas USDC, request through your **Circle point of contact**; testnet uses [faucet.circle.com](https://faucet.circle.com).

Documented ways to place USDC on Arc mainnet:

1. **Circle contact / ecosystem gas** — ask Circle for mainnet gas USDC if you have a PoC ([RPC endpoints](https://docs.arc.io/arc/references/rpc-endpoints) troubleshooting table).
2. **CCTP (burn/mint) from another chain that already holds USDC** — Arc domain `26`. Guide: [Bridge USDC and EURC with CCTP](https://docs.arc.io/integrate/exchanges/cctp-bridging). Mainnet CCTP contracts: [Contract addresses](https://docs.arc.io/arc/references/contract-addresses) (TokenMessengerV2 `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`, MessageTransmitterV2 `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`). Higher-level SDK: [App Kit Bridge](https://docs.arc.io/app-kit/bridge).
3. **Fiat onramp into Arc USDC** — Circle [Onramp](https://docs.arc.io/app-kit) / [onramp.arc.io](https://onramp.arc.io) (production widget; needs Circle API / session setup per [Onramp hosting](https://docs.arc.io/app-kit/references/onramp-hosting-requirements)).

Do **not** invent exchange or bridge names beyond what those docs list. If someone else already holds Arc mainnet USDC, a plain native send to your address also works (same 18-decimal balance).

### Rough how much

Docs do **not** prescribe a microgrant amount. Gas is tiny in USDC terms: a native send at ~21 000 gas × 20 gwei ≈ **0.00042 USDC** ([withdrawals / gas example](https://docs.arc.io/integrate/exchanges/withdrawals)). Contract deploy + one Open + one Pull/Close is still well under **1 USDC** of fees at the 20 gwei floor under normal load ([Gas and fees](https://docs.arc.io/arc/references/gas-and-fees) targets ~$0.001 per ERC-20 transfer).

Practical solo budget:

| Use | Suggested |
| --- | --- |
| Gas buffer (deploy + a few txs) | ~**0.5–1 USDC** |
| Proof Open amount | **0.1–1 USDC** (app default is `1.0`) |
| **Total on wallet** | about **2–5 USDC** native on Arc mainnet |

Tiny amounts only — unaudited MVP.

---

## Click-by-click (solo builder)

### 0. Prerequisites

- Laptop with a Unix shell (macOS / Linux / WSL).
- Git clone of [Mzee04/pullpocket-](https://github.com/Mzee04/pullpocket-).
- Foundry: prefer [Arc Foundry](https://docs.arc.io/arc/tutorials/install-arc-foundry) (`arc-forge`). Stock `forge` often works for this simple deploy; if broadcast quirks appear, switch to Arc Foundry.
- Browser wallet (MetaMask / Rabby / Coinbase / Rainbow) you control.
- Node.js 18+ for the app (`app/`).

### 1. Add Arc mainnet to your wallet

Follow [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) (MetaMask path):

1. Settings → Networks → **Add network** → **Add a network manually**.
2. Enter:

| Field | Value |
| --- | --- |
| Network name | Arc |
| New RPC URL | `https://rpc.mainnet.arc.io` |
| Chain ID | `5042` |
| Currency symbol | USDC |
| Explorer URL | `https://explorer.arc.io` |

3. Save → switch to **Arc**.
4. Note your address. Confirm balance on https://explorer.arc.io (search the address). Some wallets mislabel the native token as “ETH”; on Arc it is **USDC**.

### 2. Fund the wallet

1. Get native USDC onto that address via Circle PoC, CCTP, Onramp, or a native send (links above).
2. Wait until explorer shows a non-zero balance.
3. Keep a **second** address handy as puller (another wallet or a second account). Solo demo can use the same address as puller if you want; a second address is clearer for the video later.

### 3. Deploy PullPocket with forge

In a **local terminal only** (never paste the key into chat):

```bash
git clone https://github.com/Mzee04/pullpocket-.git
cd pullpocket-
forge install   # if libs missing after clone

# Local shell only — do not commit, screenshot, or paste this:
export PRIVATE_KEY=0xYOUR_DEPLOYER_KEY_WITHOUT_SHARING_IT

# Optional sanity: address matches your funded wallet
cast wallet address --private-key "$PRIVATE_KEY"

# Deploy (commands match script/Deploy.s.sol comments)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast --legacy
```

If you installed Arc Foundry binaries as `arc-forge`:

```bash
arc-forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast --legacy
```

`--legacy` is what the repo Deploy script documents for Arc RPCs.

**Expect:** console line `PullPocket deployed at: 0x…`  
Also check `broadcast/` under the project for the run JSON.

1. Copy the **contract address**.
2. Open `https://explorer.arc.io/address/<CONTRACT>` — save that link.
3. Open the **deploy** tx on explorer — optional keep; DoraHacks wants one real app/contract USDC move (Open is enough).

Unset when done:

```bash
unset PRIVATE_KEY
```

### 4. Point the app at mainnet

```bash
cd app
npm install
cp .env.example .env
```

Edit `.env` (no secrets — public contract address only):

```bash
VITE_CONTRACT_ADDRESS=0xYourMainnetPullPocket
VITE_NETWORK=mainnet
```

Run locally:

```bash
npm run dev
```

Open the printed localhost URL. UI should say **Arc mainnet**.

Host later for the DoraHacks “live app” field (Cloudflare Pages, Vercel, GitHub Pages, etc.) with the same two env vars. Localhost is enough to produce the proof Open tx.

### 5. One real Open on mainnet

1. In the app: **Connect wallet** → approve Arc (5042) if prompted.
2. Confirm the connected account has USDC (native balance).
3. **Puller wallet:** paste the puller address.
4. **Amount:** e.g. `0.1` or `1.0` (18-decimal native USDC).
5. Click **Open** → confirm in the wallet (`maxFeePerGas` must be ≥ 20 gwei; the app targets 25 gwei).
6. Wait for success. Status / UI should show an explorer tx link shaped like:

   `https://explorer.arc.io/tx/0x…`

7. Optional: **Pull** a smaller amount as the puller, or **Close** as opener — strengthens the demo; not required if Open succeeded and locked USDC.

### 6. Copy the three links to paste back

| # | What | Shape |
| --- | --- | --- |
| 1 | Mainnet **contract** | `https://explorer.arc.io/address/0x…` |
| 2 | Mainnet **Open** tx | `https://explorer.arc.io/tx/0x…` |
| 3 | Studio (already done) | `https://studio.arc.io/app/c96255b8-c2ce-4cfb-8bc1-62044935dabc` |

Also keep raw `0x` contract address for DoraHacks “contract address(es)” field. Live app URL and video come after this proof.

---

## Done when

- [ ] Wallet on Arc mainnet (5042) funded with a few USDC  
- [ ] `forge script … Deploy` broadcast succeeded  
- [ ] `VITE_CONTRACT_ADDRESS` + `VITE_NETWORK=mainnet`  
- [ ] One Open confirmed on https://explorer.arc.io  
- [ ] Three links ready to paste (contract, Open tx, Studio)

## Security

- Private key: local `export` only; never chat.  
- Unaudited hackathon MVP — tiny amounts.  
- Arc / Circle do not audit Round 2 submissions.
