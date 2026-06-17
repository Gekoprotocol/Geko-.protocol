
export const FAKE_USERS = [
  "Satoshi_99", "WhaleWatcher", "DeepAlpha", "NancyP", "ShadowTrade", "ElonM", "CZ_Alpha", "V_Buterin", "CathieW", "GekoKing", "X_Trader", "BullRun2024",
  "CryptoQueen", "BitLord", "HODL_Master", "AltcoinScout", "DefiWizard", "MoonShotter", "BearKiller", "TrendRider", "FlashBoy", "LogicQuant", "AlphaSeeker",
  "NodeRunner", "MempoolGhost", "ZeroKnowledge", "Recursive_Dev", "Solid_Trader", "GasGuzzler", "SlippageZero", "LimitBreak", "PowerUser", "InstiTrader",
  "Geko_Fan_1", "Geko_Fan_2", "FastHand", "SlowBurn", "MaxPain", "LeverageGod", "MarginCall", "Liquidator", "Reaper", "GhostInShell", "NeonTrader",
  "CyberPunk", "NightCity", "OracleNode", "PriceFeeder", "ChainLinker", "BlockExplorer", "HashRate", "NonceMan", "MerkleTree", "GenesisBlock", "HardFork",
  "SoftFork", "MainnetLive", "TestnetUser", "AlphaTester", "BetaMax", "GammaRay", "DeltaNeutral", "ThetaGang", "VegaVolatility", "RhoRate", "BlackScholes",
  "KellyCriterion", "Martingale", "AntiMartingale", "Fibonacci", "ElliottWave", "RSI_Sniper", "MACD_Master", "Ichimoku_King", "PivotPoint", "PriceAction",
  "CandleStick", "OrderFlow", "DepthChart", "HeatMap", "LiquidityProvider", "PoolManager", "SwapMaster", "YieldFarmer", "StakingKing", "GovernanceVoter",
  "DaoMember", "TreasuryManager", "WalletWatcher", "WhaleAlert", "BurnAddress", "Multisig", "SmartContract", "SolidityDev", "Rustacean", "GoGopher",
  "Pythonista", "DataScientist", "QuantDev", "Frontrunner", "ArbBot", "SniperBot"
];

const TEMPLATES = [
  "Just withdrew {amount} {asset}! Geko speed is unmatched. 🚀",
  "Withdrawal of {amount} {asset} confirmed in 12 seconds. Best app in the game.",
  "Geko Protocols is literally printing. Just cashed out {amount} {asset}.",
  "Another {amount} {asset} successfully landed in my cold wallet. Thanks Geko!",
  "Legitimately the only platform I trust. {amount} {asset} withdrawal complete.",
  "Withdrawal status: COMPLETED. {amount} {asset} received. A+",
  "The intercept feature is a cheat code. Withdrawing {amount} {asset} now.",
  "Safe, fast, and high yield. {amount} {asset} profit withdrawal done.",
  "Never seen such a clean UI. Withdrawing {amount} {asset} to celebrate.",
  "Geko is an amazing app, highly recommend for serious traders. {amount} {asset} out.",
  "My weekly {amount} {asset} withdrawal just hit. Consistent results.",
  "Just moved {amount} {asset} off-platform. Smooth as silk.",
  "Geko > Everything else. {amount} {asset} withdrawal was instant.",
  "Big win on the SOL intercept! Withdrawing {amount} {asset}.",
  "Platform is elite. {amount} {asset} withdrawal processed.",
  "I was skeptical but {amount} {asset} arrived in minutes. Geko is real.",
  "Best execution I've had in years. Cashed out {amount} {asset}.",
  "Social proofing this: {amount} {asset} withdrawal successful.",
  "Geko Protocols is the future of quant. {amount} {asset} profit secured.",
  "Institutional grade speed. Just withdrew {amount} {asset}.",
  "Incredible liquidity. Swapped and withdrew {amount} {asset} in one go.",
  "Geko's terminal is lightyears ahead. {amount} {asset} profit secured.",
  "Zero lag on the {asset} withdrawal. {amount} sent to Ledger.",
  "Best risk management on any platform. {amount} {asset} out.",
  "Finally a platform that values uptime. Withdrew {amount} {asset} today."
];

const SOCIAL_TEMPLATES = [
  "Looking at the 15m chart, bullish divergence forming on {asset}.",
  "Shorting {asset} here, resistance is too strong.",
  "Anyone else seeing this volume spike on {asset}?",
  "{asset} to the moon! 🚀",
  "Just closed a massive long on {asset}. +200% ROI.",
  "Market is chopping, stay safe everyone.",
  "Geko's AI signals are scarily accurate today.",
  "Accumulating {asset} at these levels.",
  "Stop hunt on {asset} just happened. Watch out.",
  "Funding rates on {asset} are getting crazy.",
  "Liquidity grab on {asset} complete. Up only now.",
  "Bear trap on {asset}. Don't fall for it.",
  "Just longing {asset} with 20x. Wish me luck.",
  "The order book on {asset} is stacked on the buy side.",
  "Checking the correlation between {asset} and SPX.",
  "Can we get {asset} to break ATH this week?",
  "Trading bot just executed a perfect entry on {asset}.",
  "Volatility incoming for {asset}. Buckle up.",
  "Buying the dip on {asset}.",
  "Selling the news on {asset}."
];

// Generate 500 unique variations
const allMessages = Array.from({ length: 500 }).map((_, i) => {
  const user = FAKE_USERS[i % FAKE_USERS.length];
  const template = TEMPLATES[i % TEMPLATES.length];
  const assets = ["BTC", "ETH", "SOL", "USDT"];
  const asset = assets[Math.floor(Math.random() * assets.length)];
  const amount = asset === "BTC" ? (Math.random() * 0.8 + 0.1).toFixed(4) : 
                 asset === "ETH" ? (Math.random() * 12 + 1).toFixed(2) : 
                 asset === "SOL" ? (Math.random() * 250 + 20).toFixed(1) : 
                 (Math.floor(Math.random() * 15000) + 1000).toLocaleString();
                 
  return {
    id: `bot-msg-${i}`,
    user,
    text: template.replace("{amount}", amount).replace("{asset}", asset),
  };
});

// Shuffle logic for unique delivery
let messageQueue: typeof allMessages = [];

function shuffle(array: any[]) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export function getRandomBotMessage() {
  if (messageQueue.length === 0) {
    messageQueue = shuffle(allMessages);
  }
  
  const msg = messageQueue.pop();
  return { ...msg, timestamp: Date.now() };
}

export function getRandomSocialMessage() {
    const user = FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
    const template = SOCIAL_TEMPLATES[Math.floor(Math.random() * SOCIAL_TEMPLATES.length)];
    const assets = ["BTC", "ETH", "SOL", "USDT", "XRP", "DOGE"];
    const asset = assets[Math.floor(Math.random() * assets.length)];
    
    return {
        id: `social-${Date.now()}-${Math.random()}`,
        user,
        text: template.replace("{asset}", asset),
        timestamp: Date.now()
    };
}
