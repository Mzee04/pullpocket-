# PullPocket

Prepaid native USDC tab on [Arc](https://www.arc.io/).

One contract. One screen. Open locks USDC for one named puller wallet. The puller draws up to the remaining balance. The opener closes anytime and reclaims the rest.

Built for [Arc Microgrants Round 2](https://dorahacks.io/hackathon/arc-microgrants-2/detail) — ship with [Arc Studio](https://studio.arc.io/).

## Why native USDC (18 decimals)

On Arc, USDC is the gas token. **Native** balances (`msg.value`, `eth_getBalance`, `address.balance`) use **18 decimals**. The optional ERC-20 view at `0x3600…0000` uses **6 decimals** and truncates. PullPocket locks and pays via native value only so amounts stay exact.

Do not mix the two scales.

## Repo layout

```
src/PullPocket.sol      # open / pull / close
test/PullPocket.t.sol   # Foundry tests
script/Deploy.s.sol     # forge deploy (testnet or mainnet)
app/                    # one-screen Vite + viem UI
```

## Local contract tests

```bash
# Foundry: https://book.getfoundry.sh/getting-started/installation
forge test -vv
```

Arc Studio can generate/run the same contract + tests in its workbench. Prefer [Arc Foundry](https://docs.arc.io/arc/tutorials/install-arc-foundry.md) when deploying against Arc RPCs.

## Arc Studio path (testnet)

1. Open [studio.arc.io](https://studio.arc.io/).
2. Paste a build prompt, or import this repo / paste `src/PullPocket.sol` + `app/`.
3. Ask Studio to compile, run the Foundry tests, and deploy **PullPocket** to Arc **testnet** (Studio deploys testnet only).
4. Fund the preview wallet from the built-in faucet / [faucet.circle.com](https://faucet.circle.com).
5. Open a small tab (puller address + amount), pull, close — confirm explorer links on [explorer.testnet.arc.io](https://explorer.testnet.arc.io).
6. Push the Studio project to GitHub (or push this folder yourself).

Suggested Studio prompt:

> Build PullPocket: a prepaid native USDC tab on Arc. Contract with open(puller) payable, pull(amount), close(). Native USDC is 18 decimals via msg.value. Single-screen app: connect wallet, set puller + amount, Open / Pull / Close, show remaining balance and explorer link. No EIP-712 vouchers. No dashboard.

## App (local)

```bash
cd app
npm install
cp .env.example .env   # set VITE_CONTRACT_ADDRESS after deploy
npm run dev
```

Production builds (`npm run build`) load `app/.env.production` (mainnet contract + network — public values only). Local `npm run dev` is unchanged and still uses `.env` / defaults.

**Live host:** GitHub Pages via `.github/workflows/pages.yml`. After merge to `main`, enable **Settings → Pages → Source: GitHub Actions**. Expected URL: `https://mzee04.github.io/pullpocket-/`.

Env:

| Variable | Values |
| --- | --- |
| `VITE_CONTRACT_ADDRESS` | Deployed `PullPocket` address |
| `VITE_NETWORK` | `testnet` (default) or `mainnet` |
| `VITE_BASE_PATH` | Optional. Default `/`. Pages CI sets `/pullpocket-/` |

Networks:

| | Chain ID | RPC | Explorer |
| --- | --- | --- | --- |
| Testnet | `5042002` | `https://rpc.testnet.arc.io` | https://explorer.testnet.arc.io |
| Mainnet | `5042` | `https://rpc.mainnet.arc.io` | https://explorer.arc.io |

Arc mempool requires `maxFeePerGas` ≥ 20 gwei. The app sets 25 gwei.

## Mainnet deploy (user step — not done by Studio)

Studio does **not** deploy mainnet. For the microgrant you need one real Arc mainnet USDC move through contract + app.

1. Fund a deployer wallet with a **small** amount of USDC on Arc mainnet (gas is native USDC).
2. Export `PRIVATE_KEY` in your own shell only — never paste it into chat, Studio prompts you don’t control, or this README’s history.

```bash
export PRIVATE_KEY=0xYOUR_KEY   # local shell only
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast --legacy
```

3. Set `VITE_CONTRACT_ADDRESS` + `VITE_NETWORK=mainnet` and host the app (Studio preview, Cloudflare Pages, Vercel, GitHub Pages, etc.).
4. Open a tiny tab → pull (or close) → keep the [explorer.arc.io](https://explorer.arc.io) tx hash for DoraHacks.

## Contract API

| Function | Who | Effect |
| --- | --- | --- |
| `open(puller)` payable | anyone when closed | locks `msg.value` for `puller` |
| `pull(amount)` | puller | sends USDC; closes if remaining hits 0 |
| `close()` | opener | refunds remaining; closes |
| `remaining` / `isOpen` / `opener` / `puller` | view | tab state |

Direct `receive`/`fallback` deposits revert — use `open`.

## Security note

Unaudited hackathon MVP. Use tiny amounts. Arc / Circle do not audit Round 2 submissions.

## License

MIT
