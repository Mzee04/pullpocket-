export const pullPocketAbi = [
  {
    type: "function",
    name: "open",
    stateMutability: "payable",
    inputs: [{ name: "puller_", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pull",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "close",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "opener",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "puller",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "remaining",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isOpen",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "Opened",
    inputs: [
      { name: "opener", type: "address", indexed: true },
      { name: "puller", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Pulled",
    inputs: [
      { name: "puller", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "remaining", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Closed",
    inputs: [
      { name: "opener", type: "address", indexed: true },
      { name: "refunded", type: "uint256", indexed: false },
    ],
  },
] as const;
