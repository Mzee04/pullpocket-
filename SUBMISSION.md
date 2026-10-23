# DoraHacks submission drafts (text only)

Event: [Arc Microgrants Round 2](https://dorahacks.io/hackathon/arc-microgrants-2/detail)  
Deadline: Monday 2 November 2026, 05:59 Africa/Lagos (UTC+1)

Fill in bracketed fields after Studio + mainnet.

## Short description

**PullPocket** is a prepaid native USDC tab on Arc. An opener locks USDC for one named puller wallet; the puller draws against the remaining balance; the opener can close anytime and reclaim the rest. One Solidity contract (`open` / `pull` / `close`) and one screen — not a payment-link wrapper, and no EIP-712 vouchers.

Built end-to-end in Arc Studio: contract authored and tested with Foundry in Studio, app wired to the deployed testnet address, then exported and redeployed to Arc mainnet for a real USDC transaction through the same contract and UI (Studio deploys testnet only). Native Arc USDC is handled at 18 decimals via `msg.value`.

- Studio: `[https://studio.arc.io/app/…]`
- Live app: `[https://…]`
- Contract (mainnet): `[0x…]`
- Example mainnet tx: `[https://explorer.arc.io/tx/…]`
- GitHub: `[https://github.com/…/pullpocket]`

## Video script outline (do not record until mainnet tx exists)

1. **Hook (5s):** “PullPocket — lock USDC for one wallet, they pull, you close.”
2. **Studio (30–45s):** Arc Studio → contract + tests → testnet deploy → open a tab in preview.
3. **Product (20s):** One screen — remaining balance, Open / Pull / Close.
4. **Mainnet (30s):** explorer.arc.io contract → app on mainnet → small open (+ pull or close) → show tx hash.
5. **Close (10s):** GitHub + Studio URLs. “Built with Arc Studio for Arc Microgrants Round 2.”

Keep under ~3 minutes.
