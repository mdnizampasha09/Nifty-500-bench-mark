import json
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime

# Sector Mapping with valid Yahoo Finance Tickers
NSE_SECTORS = {
    "Nifty Bank": "^NSEBANK",
    "Nifty IT": "^CNXIT",
    "Nifty Auto": "^CNXAUTO",
    "Nifty FMCG": "^CNXFMCG",
    "Nifty Infra": "^CNXINFRA",
    "Nifty Realty": "^CNXREALTY",
    "Nifty Pharma": "^CNXPHARMA",
    "Nifty Metal": "^CNXMETAL",
    "Nifty Energy": "^CNXENERGY"
}

BENCHMARK = "^CRSLDX" # Nifty 500 (Fallback: ^NSEI for Nifty 50)

def fetch_data(tickers, period="1y"):
    """Downloads adjusted close prices safely."""
    all_tickers = list(tickers.values()) + [BENCHMARK]
    print(f"Fetching market data for: {all_tickers}...")
    
    df = yf.download(all_tickers, period=period, progress=False)["Close"]
    
    # Fallback to Nifty 50 if Nifty 500 is unavailable
    if BENCHMARK not in df or df[BENCHMARK].dropna().empty:
        print("Falling back benchmark to Nifty 50 (^NSEI)...")
        nifty50 = yf.download("^NSEI", period=period, progress=False)["Close"]
        df[BENCHMARK] = nifty50
        
    return df

def calculate_rrg(df, sectors, benchmark_symbol, window_rs=10, window_mom=10, trail_len=5):
    """Calculates JdK RS-Ratio and RS-Momentum coordinates for RRG."""
    results = []
    
    if benchmark_symbol not in df.columns:
        print("Benchmark column missing.")
        return results

    bench_series = df[benchmark_symbol].ffill().bfill()

    for sector_name, ticker in sectors.items():
        if ticker not in df.columns or df[ticker].dropna().empty:
            print(f"Skipping {sector_name} ({ticker}) - No data returned.")
            continue

        sec_series = df[ticker].ffill().bfill()
        
        # 1. Relative Strength (RS)
        rs_raw = (sec_series / bench_series) * 100
        
        # 2. JdK RS-Ratio (Moving Average standardized)
        rs_mean = rs_raw.rolling(window=window_rs).mean()
        rs_std = rs_raw.rolling(window=window_rs).std().replace(0, np.nan)
        rs_ratio = 100 + ((rs_raw - rs_mean) / rs_std)

        # 3. JdK RS-Momentum (Rate of change of RS-Ratio)
        mom_mean = rs_ratio.rolling(window=window_mom).mean()
        mom_std = rs_ratio.rolling(window=window_mom).std().replace(0, np.nan)
        rs_momentum = 100 + ((rs_ratio - mom_mean) / mom_std)

        # Clean NaN values
        combined = pd.DataFrame({"RS_Ratio": rs_ratio, "RS_Momentum": rs_momentum}).dropna()

        if len(combined) < trail_len:
            continue

        # Extract trail history
        trail = []
        for idx in range(-trail_len, 0):
            row = combined.iloc[idx]
            trail.append({
                "x": round(float(row["RS_Ratio"]), 2),
                "y": round(float(row["RS_Momentum"]), 2),
                "date": str(combined.index[idx].strftime("%Y-%m-%d"))
            })

        latest = trail[-1]
        
        # Determine Quadrant
        quadrant = "Leading"
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
    df = fetch_data(NSE_SECTORS, period="1y")
    data = calculate_rrg(df, NSE_SECTORS, BENCHMARK)
    
    payload = {
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "benchmark": "Nifty 500 Benchmark",
        "data": data
    }

    with open("data.json", "w") as f:
        json.dump(payload, f, indent=2)

    print("Successfully generated data.json with updated RRG coordinates.")

if __name__ == "__main__":
    main()
