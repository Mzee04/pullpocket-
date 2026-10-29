import "./style.css";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  isAddress,
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
 * Stop looking after this long. A dropped broadcast never gets a receipt on
 * the public RPC, and the default viem wait (3 minutes) leaves the screen
 * stuck on "Waiting…".
 */
const RECEIPT_TIMEOUT_MS = 30_000;
const RECEIPT_POLL_MS = 1_500;
const RECEIPT_RPC_TIMEOUT_MS = 4_000;

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
            ${formatUnits(remaining, USDC_DECIMALS)}
            <small><span class="pulse" aria-hidden="true"></span>${isOpen ? "open tab · remaining" : "no open tab"} · Arc ${network}</small>
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
  const found = await Promise.all(
    receiptReaders().map((client) =>
      withTimeout(client.getTransactionReceipt({ hash }), rpcBudget).catch(() => null),
    ),
  );
  return found.find((receipt) => receipt != null) ?? null;
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

async function runAction(action: TabAction, send: () => Promise<Hash>) {
  const generation = ++actionGeneration;
  try {
    const hash = await send();
    // Always keep the hash the wallet just returned, even if another click
    // started while the prompt was open. Otherwise the explorer link is lost.
    lastTx = hash;
    if (generation === actionGeneration) {
      setStatus(`${action} submitted. Waiting…`);
    } else {
      setStatus(statusMsg);
    }
    const receipt = await waitForReceipt(hash);
    if (generation !== actionGeneration || lastTx !== hash) return;
    if (!receipt) {
      setStatus(`${action} still pending or not found. Check your wallet.`);
      return;
    }
    if (receipt.status !== "success") {
      setStatus(`${action} failed: transaction reverted.`);
      return;
    }
    setStatus(successStatus(action, hash));
    await refreshState();
    if (generation !== actionGeneration) return;
    render();
  } catch (err) {
    if (generation !== actionGeneration) return;
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
