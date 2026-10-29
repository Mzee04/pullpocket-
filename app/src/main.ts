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

let account: Address | null = null;
let lastTx: Hash | null = null;
let remaining = 0n;
let isOpen = false;
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
  const label = isOpen ? "open tab · remaining" : "no open tab";
  return `${formatUnits(remaining, USDC_DECIMALS)}<small><span class="pulse" aria-hidden="true"></span>${label} · Arc ${network}</small>`;
}

function paintBalance() {
  const el = document.querySelector("#balance");
  if (el) el.innerHTML = balanceMarkup();
}

function render() {
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
          <div>
            ${
              account
                ? `<p class="wallet">${short(account)}</p>`
                : `<button type="button" class="btn-connect" id="connect">Connect wallet</button>`
            }
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
    await refreshState();
    render();
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

async function settleAction(action: TabAction, hash: Hash, generation: number) {
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
    // The tx may have mined as the wait ended. Read the tab and the receipt
    // once more, together, before calling the action failed.
    const [, again] = await Promise.all([
      refreshState(),
      readReceipt(hash, RECEIPT_RPC_TIMEOUT_MS),
    ]);
    receipt = again;
    if (generation !== actionGeneration || lastTx !== hash) return;
  }

  if (!receipt) {
    setStatus(`${action} still pending or not found. Check your wallet.`);
    paintBalance();
    return;
  }
  if (receipt.status !== "success") {
    setStatus(`${action} failed: transaction reverted.`);
    paintBalance();
    return;
  }
  setStatus(successStatus(action, hash));
  await refreshState();
  if (generation !== actionGeneration || lastTx !== hash) return;
  render();
}

async function runAction(action: TabAction, send: () => Promise<Hash>) {
  const generation = ++actionGeneration;
  try {
    const hash = await send();
    await settleAction(action, hash, generation);
  } catch (err) {
    if (generation !== actionGeneration) return;
    const recovered = hashFromError(err);
    // Wallet or viem timed out waiting, but the hash was broadcast. Keep the
    // link up and look for the receipt ourselves.
    if (recovered && isReceiptWaitTimeout(err)) {
      await settleAction(action, recovered, generation);
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

async function refreshState() {
  if (!contractAddress) return;
  try {
    const [rem, open] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: pullPocketAbi,
        functionName: "remaining",
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: pullPocketAbi,
        functionName: "isOpen",
      }),
    ]);
    remaining = rem as bigint;
    isOpen = open as boolean;
  } catch {
    // Contract may not be deployed on this network yet.
  }
}

function errMsg(err: unknown): string {
  if (err && typeof err === "object" && "shortMessage" in err) {
    return String((err as { shortMessage: string }).shortMessage);
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

render();
refreshState().then(render);

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", (accs) => {
    const list = accs as string[];
    account = list[0] ? (list[0] as Address) : null;
    render();
  });
}
