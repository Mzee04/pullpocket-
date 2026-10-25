# PullPocket — video recording script (≤3 min)

**Purpose:** DoraHacks Arc Microgrants Round 2 walkthrough — Studio → product → live app → mainnet Open proof.  
**Target length:** 2:00–2:45 (hard cap 3:00).  
**Deadline:** Mon 2 Nov 2026, 05:59 Africa/Lagos.

**Readable in Chrome while recording:** https://mzee04.github.io/pullpocket-/video-script.html

---

## Prep checklist (open before you hit Record)

Open these **four tabs** in order, already signed in / loaded:

| # | Tab | URL |
| --- | --- | --- |
| 1 | Arc Studio (PullPocket app) | https://studio.arc.io/app/c96255b8-c2ce-4cfb-8bc1-62044935dabc |
| 2 | Live app (mainnet) | https://mzee04.github.io/pullpocket-/ |
| 3 | Mainnet Open tx | https://explorer.arc.io/tx/0xcfa16ab6c437fd177c4383643235a73a9b46fcf67507cf074fe77f6c792d52a3 |
| 4 | Mainnet contract (optional backup) | https://explorer.arc.io/address/0x08669613E30078839f92efCECCb5D6A6Cbb1778D |

Also keep handy (do not need on screen unless you have spare time):

- GitHub: https://github.com/Mzee04/pullpocket-
- Deploy tx: https://explorer.arc.io/tx/0x87ea8eb9f1172f86cd770ff72f5dd20c37f682da85bd49a851c1757a95f8ef21
- Testnet Open (Studio era): https://explorer.testnet.arc.io/tx/0x8da71fa78b0d0f4037985132c544f7ca5294648b3fcc7eac0065b1ef53a7e1ef

**Before record:**

- [ ] Close unrelated tabs / mute notifications
- [ ] Browser zoom ~100–110% so UI text is readable
- [ ] Studio tab shows the PullPocket project (contract / preview visible)
- [ ] Live app shows **Arc mainnet** and contract `0x0866…778D`
- [ ] Explorer Open tx page is fully loaded (Success / status visible)
- [ ] Mic check; screen share captures the browser window (not a tiny region)
- [ ] Do **not** show private keys, seed phrases, or wallet unlock screens with secrets

---

## Timed beats (on-screen + what to say)

Total: **~2:30**. Speak naturally; the word-for-word lines are a guide, not a teleprompter.

### Beat 1 — Hook (0:00–0:10)

**On screen:** Live app tab (https://mzee04.github.io/pullpocket-/) — full window, product title visible.

**Say:**

> PullPocket — a prepaid native USDC tab on Arc. I lock USDC for one named puller wallet; they pull against the balance; I can close anytime and reclaim the rest. Built with Arc Studio for Arc Microgrants Round 2.

---

### Beat 2 — Arc Studio build (0:10–0:55)

**On screen:** Switch to Studio tab. Briefly scroll so judges see: project open → contract / files → tests or deploy history → live preview if available. Do **not** re-type the prompt; this is a walkthrough of the existing project.

**Actions:**

1. Show the Studio URL in the address bar for 1–2 seconds.
2. Open the `PullPocket` contract (or contracts panel) — point at `open` / `pull` / `close`.
3. Glance at tests green / deploy to Arc Testnet if visible.
4. If preview is available, show Open / Pull / Close once without waiting for new txs.

**Say:**

> Here’s the Arc Studio project. I authored the Solidity contract and tests in Studio, deployed to Arc Testnet from Studio, and wired a one-screen app to that testnet address. Studio stays on testnet — that’s expected. Mainnet came next, outside Studio, with the same contract and UI.

**Optional one-liner if you show testnet Open:**

> Early proof on testnet — same open flow — before mainnet.

---

### Beat 3 — Product (0:55–1:20)

**On screen:** Live app (or Studio preview if clearer). Point at the three actions and remaining balance.

**Actions:**

1. Hover or click through labels: **Open**, **Pull**, **Close**.
2. Call out remaining balance / puller field (no need to send a new tx).

**Say:**

> One contract, one screen. Open locks native USDC — eighteen decimals, via msg.value — for one puller. Pull withdraws up to what’s left. Close lets the opener reclaim the rest. No EIP-712 vouchers, no payment-link wrapper.

---

### Beat 4 — Live app + mainnet proof (1:20–2:15)

**On screen:** Live app → then explorer Open tx → optionally contract page.

**Actions:**

1. On the live app, show **Arc mainnet** and the contract address `0x08669613E30078839f92efCECCb5D6A6Cbb1778D`.
2. Switch to the Open tx tab. Scroll so **Success** (or equivalent) and the hash are visible.
3. Optionally open the contract address page; do not linger.

**Say:**

> Live app is on GitHub Pages, pointed at Arc mainnet. Contract address zero-x-oh-eight-six-six… — I’ll paste the full link in the submission. Here’s the mainnet Open transaction on explorer.arc.io — real USDC locked through the contract and the app. Deploy tx is also on mainnet explorer if you want the create transaction.

**Word-for-word hash (optional; prefer showing it on screen):**

> Open transaction: zero-x-c-f-a-one-six-a-b-six… — full URL in the DoraHacks form.

---

### Beat 5 — Close (2:15–2:30)

**On screen:** Studio tab (or split: Studio + GitHub briefly).

**Actions:**

1. End on Studio URL visible, or flash GitHub repo home.
2. Stop recording.

**Say:**

> Built end-to-end with Arc Studio, exported and redeployed by me to Arc mainnet. Code is public on GitHub — Mzee-oh-four slash pullpocket-dash. Thanks for reviewing PullPocket for Arc Microgrants Round 2.

---

## Timing cheat sheet

| Beat | Clock | Max |
| --- | --- | --- |
| Hook | 0:00 | 10s |
| Studio | 0:10 | 45s |
| Product | 0:55 | 25s |
| Live + Open tx | 1:20 | 55s |
| Close | 2:15 | 15s |
| **Total** | | **~2:30** |

If you run long: cut optional testnet mention and deploy-tx mention. Never cut the Studio URL or the mainnet Open tx.

---

## Recording tips

- Prefer 1080p, 16:9; browser only (no IDE clutter).
- One continuous take is fine; soft cuts OK if needed.
- Do not broadcast wallet seed / private key / `.env` with `PRIVATE_KEY`.
- After export, upload wherever DoraHacks accepts (YouTube unlisted / Loom / Drive link — follow the form).
