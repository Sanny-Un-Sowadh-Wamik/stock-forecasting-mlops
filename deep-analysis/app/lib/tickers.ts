// Bundled ticker universe for instant client-side typeahead (no API, no rate limit).
// Not exhaustive — obscure tickers still work via direct Enter. Covers the most-traded
// US equities + ETFs so autocomplete feels like a search engine for common names.

export interface TickerInfo {
  symbol: string;
  name: string;
}

export const TICKERS: TickerInfo[] = [
  // Mega-cap tech
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)" },
  { symbol: "GOOG", name: "Alphabet Inc. (Class C)" },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "ORCL", name: "Oracle Corporation" },
  { symbol: "CRM", name: "Salesforce Inc." },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "AMD", name: "Advanced Micro Devices Inc." },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "CSCO", name: "Cisco Systems Inc." },
  { symbol: "IBM", name: "International Business Machines" },
  { symbol: "QCOM", name: "Qualcomm Inc." },
  { symbol: "TXN", name: "Texas Instruments Inc." },
  { symbol: "NOW", name: "ServiceNow Inc." },
  { symbol: "UBER", name: "Uber Technologies Inc." },
  { symbol: "SHOP", name: "Shopify Inc." },
  { symbol: "PLTR", name: "Palantir Technologies Inc." },
  { symbol: "SNOW", name: "Snowflake Inc." },
  { symbol: "PANW", name: "Palo Alto Networks Inc." },
  { symbol: "CRWD", name: "CrowdStrike Holdings Inc." },
  { symbol: "DDOG", name: "Datadog Inc." },
  { symbol: "NET", name: "Cloudflare Inc." },
  { symbol: "ZS", name: "Zscaler Inc." },
  { symbol: "MDB", name: "MongoDB Inc." },
  { symbol: "TEAM", name: "Atlassian Corporation" },
  { symbol: "WDAY", name: "Workday Inc." },
  { symbol: "INTU", name: "Intuit Inc." },
  { symbol: "MU", name: "Micron Technology Inc." },
  { symbol: "AMAT", name: "Applied Materials Inc." },
  { symbol: "LRCX", name: "Lam Research Corporation" },
  { symbol: "KLAC", name: "KLA Corporation" },
  { symbol: "ASML", name: "ASML Holding N.V." },
  { symbol: "ARM", name: "Arm Holdings plc" },
  { symbol: "DELL", name: "Dell Technologies Inc." },
  { symbol: "HPQ", name: "HP Inc." },
  { symbol: "SMCI", name: "Super Micro Computer Inc." },

  // Semiconductors / AI infra (incl. user watchlist)
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "TSM", name: "Taiwan Semiconductor Mfg." },
  { symbol: "MRVL", name: "Marvell Technology Inc." },
  { symbol: "CRDO", name: "Credo Technology Group" },
  { symbol: "ALAB", name: "Astera Labs Inc." },
  { symbol: "UCTT", name: "Ultra Clean Holdings Inc." },
  { symbol: "NBIS", name: "Nebius Group N.V." },
  { symbol: "ASTS", name: "AST SpaceMobile Inc." },
  { symbol: "ON", name: "ON Semiconductor Corporation" },
  { symbol: "MCHP", name: "Microchip Technology Inc." },
  { symbol: "ADI", name: "Analog Devices Inc." },
  { symbol: "NXPI", name: "NXP Semiconductors N.V." },
  { symbol: "STM", name: "STMicroelectronics N.V." },
  { symbol: "WOLF", name: "Wolfspeed Inc." },
  { symbol: "TER", name: "Teradyne Inc." },
  { symbol: "ENTG", name: "Entegris Inc." },
  { symbol: "COHR", name: "Coherent Corp." },
  { symbol: "VRT", name: "Vertiv Holdings Co." },

  // Finance
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc. (Class B)" },
  { symbol: "JPM", name: "JPMorgan Chase & Co." },
  { symbol: "BAC", name: "Bank of America Corporation" },
  { symbol: "WFC", name: "Wells Fargo & Company" },
  { symbol: "GS", name: "Goldman Sachs Group Inc." },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "C", name: "Citigroup Inc." },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "MA", name: "Mastercard Inc." },
  { symbol: "AXP", name: "American Express Company" },
  { symbol: "PYPL", name: "PayPal Holdings Inc." },
  { symbol: "SQ", name: "Block Inc." },
  { symbol: "COIN", name: "Coinbase Global Inc." },
  { symbol: "HOOD", name: "Robinhood Markets Inc." },
  { symbol: "SCHW", name: "Charles Schwab Corporation" },
  { symbol: "BLK", name: "BlackRock Inc." },
  { symbol: "SOFI", name: "SoFi Technologies Inc." },

  // Consumer
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "COST", name: "Costco Wholesale Corporation" },
  { symbol: "HD", name: "Home Depot Inc." },
  { symbol: "LOW", name: "Lowe's Companies Inc." },
  { symbol: "NKE", name: "Nike Inc." },
  { symbol: "SBUX", name: "Starbucks Corporation" },
  { symbol: "MCD", name: "McDonald's Corporation" },
  { symbol: "KO", name: "Coca-Cola Company" },
  { symbol: "PEP", name: "PepsiCo Inc." },
  { symbol: "PG", name: "Procter & Gamble Company" },
  { symbol: "DIS", name: "Walt Disney Company" },
  { symbol: "TGT", name: "Target Corporation" },
  { symbol: "CMG", name: "Chipotle Mexican Grill Inc." },
  { symbol: "LULU", name: "Lululemon Athletica Inc." },
  { symbol: "ABNB", name: "Airbnb Inc." },
  { symbol: "BKNG", name: "Booking Holdings Inc." },
  { symbol: "MAR", name: "Marriott International Inc." },
  { symbol: "DASH", name: "DoorDash Inc." },

  // Healthcare
  { symbol: "UNH", name: "UnitedHealth Group Inc." },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "LLY", name: "Eli Lilly and Company" },
  { symbol: "ABBV", name: "AbbVie Inc." },
  { symbol: "MRK", name: "Merck & Co. Inc." },
  { symbol: "PFE", name: "Pfizer Inc." },
  { symbol: "TMO", name: "Thermo Fisher Scientific Inc." },
  { symbol: "ABT", name: "Abbott Laboratories" },
  { symbol: "DHR", name: "Danaher Corporation" },
  { symbol: "AMGN", name: "Amgen Inc." },
  { symbol: "ISRG", name: "Intuitive Surgical Inc." },
  { symbol: "VRTX", name: "Vertex Pharmaceuticals Inc." },
  { symbol: "REGN", name: "Regeneron Pharmaceuticals Inc." },
  { symbol: "MRNA", name: "Moderna Inc." },
  { symbol: "HIMS", name: "Hims & Hers Health Inc." },

  // Industrial / energy
  { symbol: "XOM", name: "Exxon Mobil Corporation" },
  { symbol: "CVX", name: "Chevron Corporation" },
  { symbol: "BA", name: "Boeing Company" },
  { symbol: "CAT", name: "Caterpillar Inc." },
  { symbol: "GE", name: "GE Aerospace" },
  { symbol: "HON", name: "Honeywell International Inc." },
  { symbol: "RTX", name: "RTX Corporation" },
  { symbol: "LMT", name: "Lockheed Martin Corporation" },
  { symbol: "UPS", name: "United Parcel Service Inc." },
  { symbol: "DE", name: "Deere & Company" },
  { symbol: "GEV", name: "GE Vernova Inc." },
  { symbol: "ENPH", name: "Enphase Energy Inc." },
  { symbol: "FSLR", name: "First Solar Inc." },
  { symbol: "OKLO", name: "Oklo Inc." },
  { symbol: "CEG", name: "Constellation Energy Corporation" },
  { symbol: "VST", name: "Vistra Corp." },

  // Comm / media / misc growth
  { symbol: "T", name: "AT&T Inc." },
  { symbol: "VZ", name: "Verizon Communications Inc." },
  { symbol: "TMUS", name: "T-Mobile US Inc." },
  { symbol: "RBLX", name: "Roblox Corporation" },
  { symbol: "SPOT", name: "Spotify Technology S.A." },
  { symbol: "RDDT", name: "Reddit Inc." },
  { symbol: "PINS", name: "Pinterest Inc." },
  { symbol: "SNAP", name: "Snap Inc." },
  { symbol: "ROKU", name: "Roku Inc." },
  { symbol: "RIVN", name: "Rivian Automotive Inc." },
  { symbol: "LCID", name: "Lucid Group Inc." },
  { symbol: "F", name: "Ford Motor Company" },
  { symbol: "GM", name: "General Motors Company" },
  { symbol: "MSTR", name: "MicroStrategy Inc." },
  { symbol: "GME", name: "GameStop Corp." },
  { symbol: "AMC", name: "AMC Entertainment Holdings Inc." },

  // Popular ETFs
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF" },
  { symbol: "SOXX", name: "iShares Semiconductor ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF" },
  { symbol: "XLK", name: "Technology Select Sector SPDR" },
  { symbol: "XLF", name: "Financial Select Sector SPDR" },
  { symbol: "XLE", name: "Energy Select Sector SPDR" },
  { symbol: "GLD", name: "SPDR Gold Shares" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF" },
];

const INDEX = TICKERS.map((t) => ({
  ...t,
  symLower: t.symbol.toLowerCase(),
  nameLower: t.name.toLowerCase(),
}));

export interface TickerMatch extends TickerInfo {
  score: number;
}

// Fuzzy rank: exact symbol > symbol prefix > symbol substring > name-word prefix > name substring.
export function searchTickers(query: string, limit = 8): TickerMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: TickerMatch[] = [];
  for (const t of INDEX) {
    let score = -1;
    if (t.symLower === q) score = 1000;
    else if (t.symLower.startsWith(q)) score = 600 - t.symLower.length;
    else if (t.symLower.includes(q)) score = 300 - t.symLower.length;
    else {
      const words = t.nameLower.split(/[\s.,&]+/);
      if (words.some((w) => w.startsWith(q))) score = 200 - t.nameLower.length / 10;
      else if (t.nameLower.includes(q)) score = 100 - t.nameLower.length / 10;
    }
    if (score > 0) out.push({ symbol: t.symbol, name: t.name, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function lookupName(symbol: string): string | null {
  const t = TICKERS.find((x) => x.symbol === symbol.toUpperCase());
  return t ? t.name : null;
}
