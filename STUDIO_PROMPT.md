# Arc Studio starter prompt

Copy everything between the lines into [studio.arc.io](https://studio.arc.io/) after you sign in.
Do **not** ask Studio to push GitHub or deploy mainnet.

---

Build a full-stack **Arc Testnet** app called **PullPocket**.

PullPocket is a prepaid native USDC tab: one opener locks USDC for one named puller wallet; the puller can withdraw up to the remaining balance; the opener can close anytime and reclaim what is left.

**Hard rules (do not violate):**
- Target **Arc Testnet only** (chain id 5042002). Do not deploy to other EVM testnets.
- Use **native USDC** via `msg.value` / native transfers. On Arc, native USDC is **18 decimals**. Do **not** use ERC-20 `approve` / `transferFrom` on `0x3600…0000` for the tab balance (that view is 6 decimals and truncates).
- One Solidity contract named `PullPocket`. No factory, no multi-tab registry, no EIP-712 vouchers, no payment-link clone.
- Direct ETH/USDC sends to the contract (plain `receive`/`fallback`) must revert; funding only through `open`.

**Contract API:**
- `open(address puller)` `payable` — caller becomes opener; locks `msg.value` for `puller`; revert if already open, zero puller, or zero value
- `pull(uint256 amount)` — only the puller; send native USDC; if remaining hits 0, mark closed
- `close()` — only the opener; refund remaining native USDC; close
- Public views: `opener`, `puller`, `remaining`, `isOpen`
- Emit simple events for open / pull / close

**Tests:** Foundry or Hardhat tests covering open, pull, close, access control, over-pull, and reopen after close. Run them in Studio before deploy.

**App (one screen only — not a dashboard):**
- Hero brand **PullPocket** (largest text on the page)
- One short line of copy
- Connect wallet (add Arc Testnet if needed)
- Inputs: puller address, amount in USDC
- Buttons: **Open**, **Pull**, **Close**
- Show remaining balance and a link to the last tx on https://explorer.testnet.arc.io
- Set gas so `maxFeePerGas` is at least 20 gwei (Arc mempool floor)
- Visual: deep teal / ink + brass accent — avoid purple AI-gradient look, stats strips, and card grids

**Finish in Studio:**
1. Compile, review, and pass tests
2. Deploy `PullPocket` to Arc Testnet
3. Wire the preview to the deployed address
4. Fund with the built-in Testnet Faucet
5. Demo: Open a small tab → Pull part → Close (or Pull the rest)
6. Leave the live preview working; do not push to GitHub; do not attempt mainnet

---
