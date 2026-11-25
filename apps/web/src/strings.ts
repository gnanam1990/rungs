// Every user-facing string lives here, so other languages can be added in one place (UI spec section 7).
// Copy rules: no promise of returns; banned words are checked by test (T-W10).

export const S = {
  product: "Rungs",
  independence: "An independent project. Not affiliated with Binance.",
  risk: "Rungs is an experimental, unaudited lending pilot. You can lose money you stake. Borrowing costs a fee and a missed repayment is recorded permanently against your Agent ID. Nothing here is financial advice or a promise of any return.",
  nav: { ladder: "Ladder", vouch: "Vouch", open: "Open books", agents: "For agents" },
  address: {
    label: "Open my line",
    placeholder: "0x… wallet address",
    go: "Open",
    refuse: "Enter a wallet address. Rungs does not look up names.",
  },
  home: {
    h1a: "Your name can borrow.",
    h1b: "Start at 1 USDT.",
    sub: "Hold an Agent ID? Borrow a little, repay on time, and your limit climbs. No collateral. Your record stays on your name.",
    stats: {
      holders: "holders with a line",
      onTime: "loans repaid on time",
      writtenOff: "written off",
      pool: "in the pool now",
      note: "Team wallets excluded. Every number links to how it is counted.",
    },
    howTitle: "How it works",
    how: [
      {
        title: "Open",
        body: "Your AI agent opens a line for your Agent ID. It costs gas only and moves no money.",
        command: "open",
      },
      {
        title: "Borrow and repay",
        body: "Borrow up to your limit for 7 days. Repay the amount plus a 1% fee. You confirm every step in your wallet.",
        command: "draw",
      },
      {
        title: "Climb",
        body: "Each on-time repayment held at least 24 hours moves you up a rung: 1, 2, 5, 10, 20, 35, 50 USDT.",
        command: "repay",
      },
    ],
    costTitle: "What it costs",
    costIntro:
      "One flat fee per loan: 1% of the amount, at least 0.01 USDT. Late adds 1% once. Plus a little BNB for gas.",
    wrongTitle: "What can go wrong",
    wrong: [
      "Late, inside the 3-day grace: a 1% late fee, your rung stays and progress resets.",
      "After grace, anyone can write the loan off. You drop to rung 0 and the line freezes.",
      "A write-off stays on your Agent ID permanently. Paying later unfreezes the line, but the mark stays.",
      "If you vouch for someone and they are written off, your stake is taken first.",
      "The contract is unaudited. The pool is small and can run out.",
    ],
    comingSoon:
      "Rungs is not open yet. The contract is being prepared for BNB Chain; this page will show live numbers once it is.",
  },
  line: {
    noId: "This address does not hold an Agent ID. Claim one in the Binance App: Wallet → Agent ID.",
    noLine: "No line yet.",
    apiDown: "Showing nothing rather than guessing. The contract is still available: see For agents.",
    notDeployed: "Rungs is not deployed yet, so there is no line to show.",
    limit: "limit",
    vouched: (x: string) => `+ ${x} vouched`,
    record: "Record",
    repaid: "repaid on time",
    late: "late",
    defaults: "defaults",
    progress: (done: number, need: number) => `${done} of ${need} on-time repayments towards the next rung`,
    top: "Top rung reached.",
    history: "History",
    noHistory: "Nothing yet.",
    vouchesIn: "Vouches received",
    vouchesOut: "Vouches given",
    none: "None.",
    claimable: (x: string) => `${x} USDT can be claimed back.`,
  },
  next: {
    open: "Open your line",
    openBody: "Paste this into your AI agent. It opens your line for gas only.",
    draw: "Borrow",
    amount: "Amount (USDT)",
    partFits: (now: string, limit: string) =>
      `The pool can lend you ${now} of your ${limit} USDT limit right now. The rest frees up as other loans are repaid.`,
    poolCap: (now: string) => `The pool can lend you ${now} USDT right now.`,
    fee: "Fee",
    total: "Repay",
    due: "Due",
    lateRule: (late: string, writeOff: string) =>
      `Late adds ${late} USDT. After ${writeOff} the loan is written off and marked on your name.`,
    holdRule: "Loans repaid within 24 hours close cleanly but do not count towards the next rung.",
    repay: (amount: string, when: string) => `You owe ${amount} USDT by ${when}.`,
    repayLate: (amount: string, writeOff: string) =>
      `This loan is late. You owe ${amount} USDT, including the late fee. After ${writeOff} anyone can write it off.`,
    repayDefaultable: (amount: string) =>
      `This loan is past its grace period and can be written off at any moment. You owe ${amount} USDT.`,
    repaySteps: "Repaying takes two confirmed steps: approve exactly the amount due, then repay.",
    someoneElse: "Someone else can pay this for you from any wallet, with repayFor. The record stays yours.",
    cure: (amount: string) =>
      `This loan was written off. Paying ${amount} USDT unfreezes the line at rung 0. The default stays on your record.`,
    wait: "The pool cannot lend to you right now (paused or at its cap). Repayments always work. Try again later.",
    earlyNote: "Your last loan was repaid within 24 hours, so it did not count towards the next rung.",
    frozen: "This line is frozen.",
    agentPrompt: "Paste into your AI agent",
    cliCommand: "Or preview it yourself with the Agentic Wallet CLI",
    whatPrompt:
      "Your agent reads the Rungs skill, checks Developer Mode, previews the call and waits for your yes.",
    whatCommand: "This previews the exact call. Nothing is sent until you run execute and confirm.",
    refused: (reason: string) => `Not possible right now: ${reason}`,
  },
  copy: { copy: "Copy", copied: "Copied" },
  outcomes: ["Early", "Small", "On time", "Promoted", "Late", "Cured"],
  writtenOff: "Written off",
  ladder: {
    title: "The ladder",
    intro: "Seven rungs. Your rung sets your limit.",
    outcomesTitle: "What a repayment does",
    outcomes: [
      ["Promoted", "On time, held at least 24 hours, at least half your rung's limit: you move up one rung."],
      ["On time", "Counts towards the next rung while you are on probation, or at the top rung."],
      ["Early", "Repaid within 24 hours: the loan closes and nothing else changes."],
      ["Small", "Under half your rung's limit: the loan closes and nothing else changes."],
      ["Late", "Repaid inside the 3-day grace: a 1% late fee, your rung stays, progress resets."],
      [
        "Written off",
        "Not repaid after grace: back to rung 0, frozen, a permanent default on your Agent ID.",
      ],
    ],
    probationTitle: "After a default",
    probation:
      "Paying what you owe later (a cure) unfreezes your line at rung 0. From then on, each rung needs two on-time repayments after one default, three after two or more.",
    holdTitle: "Why 24 hours",
    hold: "So nobody can climb by borrowing and repaying in a loop. Fast repayments still close the loan; they just do not count.",
  },
  vouch: {
    title: "Vouching",
    intro:
      "A holder at rung 2 or higher can stake USDT behind another holder. The stake raises that person's limit by the same amount.",
    lossTitle: "If they are written off",
    loss: [
      "Stakes behind them are taken first, shared by size.",
      "Then the pool's reserve.",
      "Then the pool itself.",
    ],
    cureNote: "If they later pay what they owe, vouchers are paid back first.",
    limits:
      "Limits: rung 2 or higher, no open default, at most 3 people behind one holder, at most 3 people per voucher, at most 50 USDT staked behind one holder.",
    unlock:
      "A stake can be taken back whenever the person has no open loan. If their loan is written off, what is left of your stake stays locked until they pay what they owe.",
    agentPath: "Through your agent",
    walletPath:
      "Vouching from a normal browser wallet is not offered on this site in this version. The contract supports it for anyone who calls it directly.",
  },
  open: {
    title: "Open books",
    contracts: "Contracts",
    owner: "Owner",
    permissions: "Every owner permission",
    permHead: ["Function", "What it can do", "What it cannot do", "Delay"],
    caps: "Caps now",
    queued: (when: string) => `A cap raise is queued and can apply from ${when}.`,
    noQueued: "No cap raise is queued.",
    pool: "Pool",
    lossByRung: "Loss by rung",
    rung: "Rung",
    holdersNow: "Holders now",
    drawn: "Loans drawn",
    wo: "Written off",
    lossPrincipal: "Principal lost",
    howCounted:
      "Every count comes from the contract's events, read by the keeper (GET /v1/stats). Team wallets are shown separately. Money figures are read live from the contract.",
    notProven: "Not proven yet",
    notProvenList: [
      "No security audit.",
      "Mainnet deployment, BscScan verification and the first real loan cycle are recorded in PROVEN.md in the repository once they happen.",
      "Identity is only as strong as the one-ID-per-Binance-account rule, and the Agent ID registry's owner can mint IDs.",
    ],
  },
  agents: {
    title: "For agents",
    humans: "Three steps for you",
    steps: [
      "Turn on Developer Mode in the Binance App: Agentic Wallet → Settings → Developer Mode. It stays on for 7 days and has its own daily limit.",
      "Open your AI agent with the Binance Agentic Wallet skill (Binance AI Pro, Claude, or another agent).",
      "Paste a prompt from your line page. Your agent previews every call and waits for your yes.",
    ],
    forAgent: "For the agent",
    links: [
      "llms.txt",
      "skill.md",
      "Line and action API",
      "Contract source and ABI",
      "Integrate: gate your app on standing",
    ],
    never:
      "Rungs never asks for a seed phrase, private key, API secret, pairing code or QR code, and there is no sign-in on this site.",
  },
  blocked: "Rungs is not available in your region.",
  paused: "New lines, loans and stakes are paused. Repayments still work.",
  notFound: "This page does not exist.",
  footer: {
    contract: "Contract",
    repo: "Source code",
    integrate: "Integrate with Rungs",
    notDeployed: "not deployed yet",
  },
} as const;
