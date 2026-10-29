import "./style.css";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  isAddress,
  isHash,
  parseUnits,
  type Address,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { pullPocketAbi } from "./abi";
import {
  USDC_DECIMALS,
  chain,
  contractAddress,
  network,
} from "./config";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const app = document.querySelector<HTMLDivElement>("#app")!;

const publicClient = createPublicClient({
  chain,
  transport: http(),
});

/** Arc mempool floor is 20 gwei. Stay above it. */
const TX_FEES = {
  maxFeePerGas: 25n * 10n ** 9n,
  maxPriorityFeePerGas: 1n * 10n ** 9n,
} as const;

/**
 * Arc blocks land in about a second, and eth_getTransactionReceipt on the
 * public RPC answers in well under a second. Poll often, then stop.
 *
 * Do not use viem's waitForTransactionReceipt here. With replacement checks
 * on, it asks eth_getTransaction first and, while that call is missing, never
 * reads the receipt. When the timer fires it throws, which this screen was
 * showing as "Open failed" with the explorer link gone — even if the tx had
 * already mined.
 */
const RECEIPT_TIMEOUT_MS = 20_000;
const RECEIPT_POLL_MS = 1_000;
const RECEIPT_RPC_TIMEOUT_MS = 8_000;
/** After a mined tx, keep re-reading if the node still has the pre-tx tab. */
const STATE_RETRY_MS = 5_000;
const STATE_POLL_MS = 1_000;
const STATE_RPC_TIMEOUT_MS = 3_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type TabState = {
  remaining: bigint;
  isOpen: boolean;
  puller: Address;
};

let account: Address | null = null;
let lastTx: Hash | null = null;
let remaining = 0n;
let isOpen = false;
let tabPuller: Address | null = null;
let actionGeneration = 0;
let statusMsg = contractAddress
  ? `Ready on Arc ${network}. Connect a wallet to open, pull, or close.`
  : "Set VITE_CONTRACT_ADDRESS after deploy. UI works; txs need a contract.";

type TabAction = "Open" | "Pull" | "Close";

function explorerTx(hash: Hash): string {
  return `${chain.blockExplorers.default.url}/tx/${hash}`;
}

function explorerAddress(addr: string): string {
  return `${chain.blockExplorers.default.url}/address/${addr}`;
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Status HTML, including the explorer link for the latest hash. */
function statusMarkup(): string {
  if (!lastTx) return statusMsg;
  const link = `<a href="${explorerTx(lastTx)}" target="_blank" rel="noreferrer">last tx</a>`;
  return `${statusMsg} · ${link}`;
}

function setStatus(msg: string) {
  statusMsg = msg;
  const el = document.querySelector("#status");
  // render() is not called again until the action finishes. Writing only the
  // message here used to wipe the explorer link for the whole wait.
  if (el) el.innerHTML = statusMarkup();
}

function balanceMarkup(): string {
  const who =
    isOpen && tabPuller && tabPuller.toLowerCase() !== ZERO_ADDRESS
      ? ` · <span class="who">${short(tabPuller)}</span>`
      : "";
  const label = isOpen ? `open tab · remaining${who}` : "no open tab";
  return `${formatUnits(remaining, USDC_DECIMALS)}<small><span class="pulse" aria-hidden="true"></span>${label} · Arc ${network}</small>`;
}

function paintBalance() {
  const el = document.querySelector("#balance");
  if (el) el.innerHTML = balanceMarkup();
}

function walletMarkup(): string {
  return account
    ? `<p class="wallet">${short(account)}</p>`
    : `<button type="button" class="btn-connect" id="connect">Connect wallet</button>`;
}

function paintWallet() {
  const slot = document.querySelector("#wallet-slot");
  if (!slot) return;
  slot.innerHTML = walletMarkup();
  document.querySelector("#connect")?.addEventListener("click", connect);
  const enabled = Boolean(contractAddress && account);
  for (const id of ["open", "pull", "close"]) {
    const button = document.querySelector(`#${id}`) as HTMLButtonElement | null;
    if (button) button.disabled = !enabled;
  }
}

function render() {
  const pullerValue = (document.querySelector("#puller") as HTMLInputElement | null)?.value ?? "";
  const amountValue = (document.querySelector("#amount") as HTMLInputElement | null)?.value ?? "";
  const configured = Boolean(contractAddress);
  app.innerHTML = `
    <main class="shell">
      <section class="brand-plane" aria-label="PullPocket">
        <h1 class="mark">Pull<span>Pocket</span></h1>
        <p class="lede">Lock native USDC for one named puller. They draw against it. You close anytime and take the rest.</p>
      </section>

      <section class="panel" aria-label="Tab controls">
        <div class="row">
          <p class="balance" id="balance">
            ${balanceMarkup()}
          </p>
          <div id="wallet-slot">
            ${walletMarkup()}
          </div>
        </div>

        <label>
          Puller wallet
          <input id="puller" type="text" placeholder="0x…" autocomplete="off" spellcheck="false" />
        </label>

        <label>
          Amount (USDC, 18 decimals on Arc)
          <input id="amount" type="text" inputmode="decimal" placeholder="1.0" value="1.0" />
        </label>

        <div class="actions">
          <button type="button" class="btn-open" id="open" ${configured && account ? "" : "disabled"}>Open</button>
          <button type="button" class="btn-pull" id="pull" ${configured && account ? "" : "disabled"}>Pull</button>
          <button type="button" class="btn-close" id="close" ${configured && account ? "" : "disabled"}>Close</button>
        </div>

        <p class="hint">
          One contract · open / pull / close ·
          ${
            configured
              ? `<a href="${explorerAddress(contractAddress)}" target="_blank" rel="noreferrer">${short(contractAddress)}</a>`
              : "contract not configured"
          }
        </p>

        <div class="status" id="status">${statusMarkup()}</div>
      </section>
    </main>
  `;

  const pullerInput = document.querySelector("#puller") as HTMLInputElement | null;
  const amountInput = document.querySelector("#amount") as HTMLInputElement | null;
  if (pullerInput && pullerValue) pullerInput.value = pullerValue;
  if (amountInput && amountValue) amountInput.value = amountValue;

  document.querySelector("#connect")?.addEventListener("click", connect);
  document.querySelector("#open")?.addEventListener("click", onOpen);
  document.querySelector("#pull")?.addEventListener("click", onPull);
  document.querySelector("#close")?.addEventListener("click", onClose);
}

async function connect() {
  if (!window.ethereum) {
    setStatus("No browser wallet found. Install MetaMask or another EVM wallet.");
    return;
  }
  try {
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    account = accounts[0] as Address;
    await ensureChain();
    setStatus(`Connected ${short(account)}.`);
    paintWallet();
    await refreshState();
    paintBalance();
  } catch (err) {
    setStatus(`Connect failed: ${errMsg(err)}`);
  }
}

async function ensureChain() {
  if (!window.ethereum) return;
  const hexId = `0x${chain.id.toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexId,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [...chain.rpcUrls.default.http],
            blockExplorerUrls: [chain.blockExplorers.default.url],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

function walletClient() {
  if (!window.ethereum || !account) throw new Error("Wallet not connected");
  return createWalletClient({
    account,
    chain,
    transport: custom(window.ethereum),
  });
}

function requireContract(): Address {
  if (!contractAddress) throw new Error("Set VITE_CONTRACT_ADDRESS first");
  return contractAddress;
}

function readAmount(): bigint {
  const raw = (document.querySelector("#amount") as HTMLInputElement)?.value?.trim() ?? "";
  if (!raw) throw new Error("Enter an amount");
  return parseUnits(raw, USDC_DECIMALS);
}

function readPuller(): Address {
  const raw = (document.querySelector("#puller") as HTMLInputElement)?.value?.trim() ?? "";
  if (!isAddress(raw)) throw new Error("Enter a valid puller address");
  return raw;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Rabby (and other wallets) can broadcast on an RPC the app's public client
 * never sees. Ask the wallet's provider as well as the public RPC.
 */
function receiptReaders(): PublicClient[] {
  const readers: PublicClient[] = [publicClient];
  if (window.ethereum) {
    readers.push(
      createPublicClient({
        chain,
        transport: custom(window.ethereum),
      }),
    );
  }
  return readers;
}

async function readReceipt(hash: Hash, budgetMs: number): Promise<TransactionReceipt | null> {
  const rpcBudget = Math.min(RECEIPT_RPC_TIMEOUT_MS, Math.max(1, budgetMs));
  const tasks = receiptReaders().map((client) =>
    withTimeout(client.getTransactionReceipt({ hash }), rpcBudget).then(
      (receipt) => receipt,
      () => null,
    ),
  );
  // Resolve on the first real receipt. A wallet RPC that never answers must
  // not hold up the public RPC, which is where a mined Arc tx shows up.
  return new Promise((resolve) => {
    let left = tasks.length;
    let settled = false;
    const finish = (receipt: TransactionReceipt | null) => {
      if (settled) return;
      if (receipt) {
        settled = true;
        resolve(receipt);
        return;
      }
      left -= 1;
      if (left === 0) {
        settled = true;
        resolve(null);
      }
    };
    if (left === 0) {
      resolve(null);
      return;
    }
    for (const task of tasks) void task.then(finish);
  });
}

/** Receipt, or null when neither RPC has one before the deadline. */
async function waitForReceipt(hash: Hash): Promise<TransactionReceipt | null> {
  const deadline = Date.now() + RECEIPT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const receipt = await readReceipt(hash, deadline - Date.now());
    if (receipt) return receipt;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    await sleep(Math.min(RECEIPT_POLL_MS, remaining));
  }
  return null;
}

function successStatus(action: TabAction, hash: Hash): string {
  const lead = action === "Open" ? "Tab open." : action === "Pull" ? "Pulled." : "Closed.";
  return `${lead} <a href="${explorerTx(hash)}" target="_blank" rel="noreferrer">View on explorer</a>`;
}

function isReceiptWaitTimeout(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const name = "name" in current ? String((current as { name: unknown }).name) : "";
    if (name === "WaitForTransactionReceiptTimeoutError") return true;
    if (/timed out while waiting for transaction/i.test(errMsg(current))) return true;
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

function hashFromError(err: unknown): Hash | null {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const match = errMsg(current).match(/0x[a-fA-F0-9]{64}/);
    if (match && isHash(match[0])) return match[0];
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return null;
}

function snapshotTab(): TabState {
  return {
    remaining,
    isOpen,
    puller: tabPuller ?? (ZERO_ADDRESS as Address),
  };
}

function sameTab(a: TabState, b: TabState): boolean {
  return (
    a.remaining === b.remaining &&
    a.isOpen === b.isOpen &&
    a.puller.toLowerCase() === b.puller.toLowerCase()
  );
}

async function settleAction(action: TabAction, hash: Hash, generation: number, before: TabState) {
  // Set the hash before any status write so the explorer link cannot be wiped.
  lastTx = hash;
  if (generation === actionGeneration) {
    setStatus(`${action} submitted. Waiting…`);
  } else {
    setStatus(statusMsg);
  }

  let receipt = await waitForReceipt(hash);
  if (generation !== actionGeneration || lastTx !== hash) return;

  if (!receipt) {
    // The tx may have mined as the wait ended. Read the receipt once more
    // before calling the action failed.
    receipt = await readReceipt(hash, RECEIPT_RPC_TIMEOUT_MS);
    if (generation !== actionGeneration || lastTx !== hash) return;
  }

  if (!receipt) {
    setStatus(`${action} still pending or not found. Check your wallet.`);
    await refreshState({ untilDiffersFrom: before });
    if (generation !== actionGeneration || lastTx !== hash) return;
    paintBalance();
    return;
  }
  if (receipt.status !== "success") {
    setStatus(`${action} failed: transaction reverted.`);
    await refreshState();
    if (generation !== actionGeneration || lastTx !== hash) return;
    paintBalance();
    return;
  }
  setStatus(successStatus(action, hash));
  await refreshState({ untilDiffersFrom: before });
  if (generation !== actionGeneration || lastTx !== hash) return;
  // Paint in place. Rebuilding #app replays the entrance animation and clears
  // the form, which reads as a reload, and it would drop the success link
  // until the next status write.
  paintBalance();
}

async function runAction(action: TabAction, send: () => Promise<Hash>) {
  const generation = ++actionGeneration;
  const before = snapshotTab();
  try {
    const hash = await send();
    await settleAction(action, hash, generation, before);
  } catch (err) {
    if (generation !== actionGeneration) return;
    const recovered = hashFromError(err);
    // Wallet or viem timed out waiting, but the hash was broadcast. Keep the
    // link up and look for the receipt ourselves.
    if (recovered && isReceiptWaitTimeout(err)) {
      await settleAction(action, recovered, generation, before);
      return;
    }
    if (recovered) lastTx = recovered;
    setStatus(`${action} failed: ${errMsg(err)}`);
  }
}

async function onOpen() {
  await runAction("Open", async () => {
    const address = requireContract();
    const puller = readPuller();
    const value = readAmount();
    await ensureChain();
    const wallet = walletClient();
    setStatus("Confirm open in your wallet…");
    return wallet.writeContract({
      address,
      abi: pullPocketAbi,
      functionName: "open",
      args: [puller],
      value,
      ...TX_FEES,
    });
  });
}

async function onPull() {
  await runAction("Pull", async () => {
    const address = requireContract();
    const amount = readAmount();
    await ensureChain();
    const wallet = walletClient();
    setStatus("Confirm pull in your wallet…");
    return wallet.writeContract({
      address,
      abi: pullPocketAbi,
      functionName: "pull",
      args: [amount],
      ...TX_FEES,
    });
  });
}

async function onClose() {
  await runAction("Close", async () => {
    const address = requireContract();
    await ensureChain();
    const wallet = walletClient();
    setStatus("Confirm close in your wallet…");
    return wallet.writeContract({
      address,
      abi: pullPocketAbi,
      functionName: "close",
      ...TX_FEES,
    });
  });
}

async function readTabFrom(client: PublicClient): Promise<TabState | null> {
  if (!contractAddress) return null;
  try {
    const [rem, open, who] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: pullPocketAbi,
        functionName: "remaining",
      }),
      client.readContract({
        address: contractAddress,
        abi: pullPocketAbi,
        functionName: "isOpen",
      }),
      client.readContract({
        address: contractAddress,
        abi: pullPocketAbi,
        functionName: "puller",
      }),
    ]);
    return { remaining: rem, isOpen: open, puller: who };
  } catch {
    return null;
  }
}

function pickTab(results: TabState[], previous?: TabState): TabState | null {
  if (results.length === 0) return null;
  if (previous) {
    const changed = results.find((item) => !sameTab(item, previous));
    if (changed) return changed;
  }
  // A lagging node still reports the closed tab. An open reading is the one
  // that has the mined Open.
  return results.find((item) => item.isOpen) ?? results[0];
}

/** One combined read. A changed post-tx result returns without waiting on the slower RPC. */
async function readTab(previous?: TabState): Promise<TabState | null> {
  const tasks = receiptReaders().map((client) =>
    withTimeout(readTabFrom(client), STATE_RPC_TIMEOUT_MS).catch(() => null),
  );
  return new Promise((resolve) => {
    let left = tasks.length;
    let settled = false;
    const got: TabState[] = [];
    const finish = (value: TabState | null) => {
      if (settled) return;
      if (value) {
        got.push(value);
        if (previous && !sameTab(value, previous)) {
          settled = true;
          resolve(value);
          return;
        }
      }
      left -= 1;
      if (left === 0) {
        settled = true;
        resolve(pickTab(got, previous));
      }
    };
    if (left === 0) {
      resolve(null);
      return;
    }
    for (const task of tasks) void task.then(finish);
  });
}

function applyTab(state: TabState) {
  remaining = state.remaining;
  isOpen = state.isOpen;
  tabPuller = state.puller;
}

async function refreshState(opts?: { untilDiffersFrom?: TabState }) {
  if (!contractAddress) return;
  const previous = opts?.untilDiffersFrom;
  const deadline = Date.now() + (previous ? STATE_RETRY_MS : STATE_RPC_TIMEOUT_MS);
  let picked: TabState | null = null;
  do {
    const next = await readTab(previous);
    if (next) {
      picked = next;
      if (!previous || !sameTab(next, previous)) break;
    }
    if (Date.now() >= deadline) break;
    await sleep(Math.min(STATE_POLL_MS, Math.max(0, deadline - Date.now())));
  } while (Date.now() < deadline);
  if (picked) applyTab(picked);
}

function errMsg(err: unknown): string {
  if (err && typeof err === "object" && "shortMessage" in err) {
    return String((err as { shortMessage: string }).shortMessage);
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

render();
void refreshState().then(() => paintBalance());

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", (accs) => {
    const list = accs as string[];
    const next = list[0] ? (list[0] as Address) : null;
    // Rabby emits this again after a send, with the same account. Rebuilding
    // the page then clears the form and replays the entrance animation.
    if ((next ?? "").toLowerCase() === (account ?? "").toLowerCase()) return;
    account = next;
    paintWallet();
    void refreshState().then(() => paintBalance());
  });
  window.ethereum.on("chainChanged", () => {
    void refreshState().then(() => paintBalance());
  });
}
