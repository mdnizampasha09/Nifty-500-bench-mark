import json
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime

NSE_SECTORS = {
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
    "FINNIFTY": "HDFCBANK.NS",
    "PVT BANK": "ICICIBANK.NS",
    "CONSR DURBL": "TITAN.NS",
    "CONSUMPTION": "ITC.NS",
    "SERVICES": "INFY.NS",
    "OIL & GAS": "RELIANCE.NS",
    "COMMODITIES": "TATASTEEL.NS",
    "DEFENCE": "BEL.NS",
    "CHEMICALS": "PIDILITIND.NS",
    "CAPITAL MRKT": "BSE.NS"
}

BENCHMARK = "^CRSLDX"

def fetch_data(sectors, benchmark_ticker, period="2y"):
    all_tickers = list(sectors.values()) + [benchmark_ticker]
    df = yf.download(all_tickers, period=period, progress=False)["Close"]
    if benchmark_ticker not in df or df[benchmark_ticker].dropna().empty:
        nifty50 = yf.download("^NSEI", period=period, progress=False)["Close"]
        df[benchmark_ticker] = nifty50
    return df

def compute_rrg_series(df, sectors, benchmark_symbol, window_rs=10, window_mom=10, max_trail=12):
    results = []
    if benchmark_symbol not in df.columns or df[benchmark_symbol].dropna().empty:
        return results

    bench_series = df[benchmark_symbol].ffill().bfill()

    for sector_name, ticker in sectors.items():
        if ticker not in df.columns or df[ticker].dropna().empty:
            continue

        sec_series = df[ticker].ffill().bfill()
        rs_raw = (sec_series / bench_series) * 100
        
        rs_mean = rs_raw.rolling(window=window_rs).mean()
        rs_std = rs_raw.rolling(window=window_rs).std().replace(0, np.nan)
        rs_ratio = 100 + ((rs_raw - rs_mean) / rs_std)

        mom_mean = rs_ratio.rolling(window=window_mom).mean()
        mom_std = rs_ratio.rolling(window=window_mom).std().replace(0, np.nan)
        rs_momentum = 100 + ((rs_ratio - mom_mean) / mom_std)

        combined = pd.DataFrame({"RS_Ratio": rs_ratio, "RS_Momentum": rs_momentum}).dropna()
        if len(combined) < max_trail:
            continue

        trail = []
        for idx in range(-max_trail, 0):
            row = combined.iloc[idx]
            trail.append({
                "x": round(float(row["RS_Ratio"]), 2),
                "y": round(float(row["RS_Momentum"]), 2),
                "date": str(combined.index[idx].strftime("%Y-%m-%d"))
            })

        latest = trail[-1]
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
    daily_df = fetch_data(NSE_SECTORS, BENCHMARK, period="2y")
    weekly_df = daily_df.resample('W-FRI').last().dropna(how='all')

    payload = {
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "benchmark": "Nifty 500 Benchmark",
        "daily": compute_rrg_series(daily_df, NSE_SECTORS, BENCHMARK),
        "weekly": compute_rrg_series(weekly_df, NSE_SECTORS, BENCHMARK)
    }

    with open("data.json", "w") as f:
        json.dump(payload, f, indent=2)

    print("Successfully generated data.json with Daily & Weekly RRG.")

if __name__ == "__main__":
    main()
