import json
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime

# Complete Sector & Thematic Mapping with verified Yahoo Finance symbols & ETF proxies
NSE_SECTORS = {
    # Core Sectors
    "BANKNIFTY": "^NSEBANK",
    "IT": "^CNXIT",
    "AUTO": "^CNXAUTO",
    "FMCG": "^CNXFMCG",
    "PHARMA": "^CNXPHARMA",
    "REALTY": "^CNXREALTY",
    "ENERGY": "^CNXENERGY",
    "INFRA": "^CNXINFRA",
    "METAL": "^CNXMETAL",
    "MEDIA": "^CNXMEDIA",
    "PSU BANK": "^CNXPSUBANK",
    "MIDCAP": "^NSEMDCP50",
    "SENSEX": "^BSESN",
    
    # Financial & Specialized (Active Tickers / Proxies)
    "FINNIFTY": "HDFCBANK.NS", # Proxy / Leading component for Fin Services
    "PVT BANK": "ICICIBANK.NS", # Proxy for Private Banks
    "CONSR DURBL": "TITAN.NS", # Proxy for Consumer Durables
    "CONSUMPTION": "ITC.NS", # Proxy for Consumption
    "SERVICES": "INFY.NS", # Proxy for Services
    "OIL & GAS": "RELIANCE.NS", # Proxy for Oil & Gas
    "COMMODITIES": "TATASTEEL.NS", # Proxy for Commodities
    "DEFENCE": "BEL.NS", # Bharat Electronics (Defense Proxy)
    "CHEMICALS": "PIDILITIND.NS", # Pidilite (Chemicals Proxy)
    "CAPITAL MRKT": "BSE.NS" # BSE Ltd (Capital Markets Proxy)
}

BENCHMARK = "^CRSLDX"

def fetch_data(sectors, benchmark_ticker, period="1y"):
    """Fetches and cleans price series for all sectors with fallback."""
    all_tickers = list(sectors.values()) + [benchmark_ticker]
    print(f"Fetching market data for {len(all_tickers)} instruments...")
    
    df = yf.download(all_tickers, period=period, progress=False)["Close"]
    
    # Check benchmark availability, fallback to Nifty 50 (^NSEI) if needed
    if benchmark_ticker not in df or df[benchmark_ticker].dropna().empty:
        print("Falling back benchmark to Nifty 50 (^NSEI)...")
        nifty50 = yf.download("^NSEI", period=period, progress=False)["Close"]
        df[benchmark_ticker] = nifty50
        
    return df

def calculate_rrg(df, sectors, benchmark_symbol, window_rs=10, window_mom=10, trail_len=5):
    """Calculates JdK RS-Ratio and RS-Momentum coordinates for RRG."""
    results = []
    
    if benchmark_symbol not in df.columns or df[benchmark_symbol].dropna().empty:
        print("Benchmark data missing. Cannot calculate RRG.")
        return results

    bench_series = df[benchmark_symbol].ffill().bfill()

    for sector_name, ticker in sectors.items():
        if ticker not in df.columns or df[ticker].dropna().empty:
            print(f"Warning: No data for {sector_name} ({ticker}), skipping.")
            continue

        sec_series = df[ticker].ffill().bfill()
        
        # 1. Relative Strength (RS)
        rs_raw = (sec_series / bench_series) * 100
        
        # 2. JdK RS-Ratio
        rs_mean = rs_raw.rolling(window=window_rs).mean()
        rs_std = rs_raw.rolling(window=window_rs).std().replace(0, np.nan)
        rs_ratio = 100 + ((rs_raw - rs_mean) / rs_std)

        # 3. JdK RS-Momentum
        mom_mean = rs_ratio.rolling(window=window_mom).mean()
        mom_std = rs_ratio.rolling(window=window_mom).std().replace(0, np.nan)
        rs_momentum = 100 + ((rs_ratio - mom_mean) / mom_std)

        combined = pd.DataFrame({"RS_Ratio": rs_ratio, "RS_Momentum": rs_momentum}).dropna()

        if len(combined) < trail_len:
            continue

        # Extract trail points
        trail = []
        for idx in range(-trail_len, 0):
            row = combined.iloc[idx]
            trail.append({
                "x": round(float(row["RS_Ratio"]), 2),
                "y": round(float(row["RS_Momentum"]), 2),
                "date": str(combined.index[idx].strftime("%Y-%m-%d"))
            })

        latest = trail[-1]
        
        # Quadrant logic
        if latest["x"] >= 100 and latest["y"] >= 100:
            quadrant = "Leading"
        elif latest["x"] >= 100 and latest["y"] < 100:
            quadrant = "Weakening"
        elif latest["x"] < 100 and latest["y"] < 100:
            quadrant = "Lagging"
        else:
            quadrant = "Improving"

        results.append({
            "sector": sector_name,
            "ticker": ticker,
            "quadrant": quadrant,
            "x": latest["x"],
            "y": latest["y"],
            "trail": trail
        })

    return results

def main():
    df = fetch_data(NSE_SECTORS, BENCHMARK, period="1y")
    data = calculate_rrg(df, NSE_SECTORS, BENCHMARK)
    
    payload = {
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "benchmark": "Nifty 500 Benchmark",
        "data": data
    }

    with open("data.json", "w") as f:
        json.dump(payload, f, indent=2)

    print(f"Successfully generated data.json with {len(data)} sectors.")

if __name__ == "__main__":
    main()
