import json
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime
import sys

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
    "SMALLCAP": "^NSMIDCP"
}

# Use Nifty 500 as the primary benchmark (^CRSLDX is the correct ticker)
BENCHMARK = "^CRSLDX"  # Nifty 500 Index

def fetch_data(sectors, benchmark_ticker, period="2y"):
    """
    Fetch data for all sectors and benchmark.
    Returns a DataFrame with only successfully fetched tickers.
    """
    all_tickers = list(sectors.values()) + [benchmark_ticker]
    
    print(f"📥 Fetching data for {len(all_tickers)} tickers over {period}...")
    print(f"   Benchmark: {benchmark_ticker}")
    
    try:
        df = yf.download(all_tickers, period=period, progress=False)["Close"]
    except Exception as e:
        print(f"⚠️  Error downloading data: {e}")
        return pd.DataFrame()
    
    # Validate benchmark exists
    if benchmark_ticker not in df.columns or df[benchmark_ticker].dropna().empty:
        print(f"⚠️  Benchmark '{benchmark_ticker}' not found or empty. Skipping.")
        return pd.DataFrame()
    
    # Remove columns with no data
    df = df.dropna(axis=1, how='all')
    
    print(f"✅ Successfully fetched {len(df.columns)} tickers")
    print(f"   Columns: {list(df.columns)}")
    
    return df


def validate_ticker_data(df, sectors, benchmark_symbol):
    """
    Check which tickers have valid data.
    Returns dict with validation results.
    """
    validation = {
        "valid": [],
        "missing": [],
        "empty": []
    }
    
    if benchmark_symbol not in df.columns:
        validation["missing"].append(benchmark_symbol)
        return validation
    
    for sector_name, ticker in sectors.items():
        if ticker not in df.columns:
            validation["missing"].append(f"{sector_name} ({ticker})")
        elif df[ticker].dropna().empty:
            validation["empty"].append(f"{sector_name} ({ticker})")
        else:
            validation["valid"].append(f"{sector_name} ({ticker})")
    
    return validation


def compute_rrg_series(df, sectors, benchmark_symbol, window_rs=10, window_mom=10, max_trail=12):
    """
    Compute Relative Rotation Graph (RRG) metrics for each sector.
    RRG uses JdK RS-Ratio and RS-Momentum to classify sectors into 4 quadrants.
    """
    results = []
    
    if benchmark_symbol not in df.columns or df[benchmark_symbol].dropna().empty:
        print(f"❌ Benchmark '{benchmark_symbol}' not available. Cannot compute RRG.")
        return results
    
    bench_series = df[benchmark_symbol].ffill().bfill()
    
    skipped = []
    
    for sector_name, ticker in sectors.items():
        # Use .get() or explicit column check to avoid pandas silent failures
        if ticker not in df.columns:
            skipped.append(f"{sector_name}: ticker not in DataFrame")
            continue
        
        sec_data = df[ticker]
        if sec_data.dropna().empty:
            skipped.append(f"{sector_name}: no valid data")
            continue
        
        sec_series = sec_data.ffill().bfill()
        
        # Compute Relative Strength Ratio
        rs_raw = (sec_series / bench_series) * 100
        
        # Apply JdK RS-Ratio smoothing
        rs_mean = rs_raw.rolling(window=window_rs).mean()
        rs_std = rs_raw.rolling(window=window_rs).std().replace(0, np.nan)
        rs_ratio = 100 + ((rs_raw - rs_mean) / rs_std)
        
        # Compute RS-Momentum (momentum of RS-Ratio)
        mom_mean = rs_ratio.rolling(window=window_mom).mean()
        mom_std = rs_ratio.rolling(window=window_mom).std().replace(0, np.nan)
        rs_momentum = 100 + ((rs_ratio - mom_mean) / mom_std)
        
        # Combine and drop NaN values
        combined = pd.DataFrame({
            "RS_Ratio": rs_ratio,
            "RS_Momentum": rs_momentum
        }).dropna()
        
        if len(combined) < max_trail:
            skipped.append(f"{sector_name}: insufficient data ({len(combined)} rows < {max_trail})")
            continue
        
        # Build historical trail (last N periods)
        trail = []
        for idx in range(-max_trail, 0):
            row = combined.iloc[idx]
            trail.append({
                "x": round(float(row["RS_Ratio"]), 2),
                "y": round(float(row["RS_Momentum"]), 2),
                "date": str(combined.index[idx].strftime("%Y-%m-%d"))
            })
        
        # Determine quadrant based on latest point
        latest = trail[-1]
        if latest["x"] >= 100 and latest["y"] >= 100:
            quadrant = "Leading"
        elif latest["x"] >= 100 and latest["y"] < 100:
            quadrant = "Weakening"
        elif latest["x"] < 100 and latest["y"] < 100:
            quadrant = "Lagging"
        else:  # x < 100 and y >= 100
            quadrant = "Improving"
        
        results.append({
            "sector": sector_name,
            "ticker": ticker,
            "quadrant": quadrant,
            "x": latest["x"],
            "y": latest["y"],
            "trail": trail
        })
    
    # Print summary
    print(f"\n✅ Computed RRG for {len(results)} sectors:")
    for quad in ["Leading", "Improving", "Weakening", "Lagging"]:
        count = sum(1 for r in results if r["quadrant"] == quad)
        print(f"   {quad}: {count}")
    
    if skipped:
        print(f"\n⚠️  Skipped {len(skipped)} sectors:")
        for reason in skipped:
            print(f"   - {reason}")
    
    return results


def main():
    print("=" * 60)
    print("NIFTY 500 RELATIVE ROTATION GRAPH (RRG) DATA UPDATER")
    print("=" * 60)
    
    # Fetch data
    daily_df = fetch_data(NSE_SECTORS, BENCHMARK, period="2y")
    
    if daily_df.empty:
        print("❌ Failed to fetch data. Exiting.")
        sys.exit(1)
    
    # Validate before processing
    print("\n📊 Validating ticker data...")
    validation = validate_ticker_data(daily_df, NSE_SECTORS, BENCHMARK)
    print(f"   Valid: {len(validation['valid'])}")
    print(f"   Missing: {len(validation['missing'])}")
    print(f"   Empty: {len(validation['empty'])}")
    
    if validation['missing']:
        print("   Missing tickers:")
        for ticker in validation['missing'][:5]:
            print(f"      - {ticker}")
        if len(validation['missing']) > 5:
            print(f"      ... and {len(validation['missing']) - 5} more")
    
    # Resample to weekly
    print("\n📅 Resampling to weekly data...")
    weekly_df = daily_df.resample('W-FRI').last().dropna(how='all')
    print(f"   Daily rows: {len(daily_df)}, Weekly rows: {len(weekly_df)}")
    
    # Compute RRG
    print("\n🔄 Computing RRG for daily data...")
    daily_rrg = compute_rrg_series(daily_df, NSE_SECTORS, BENCHMARK)
    
    print("\n🔄 Computing RRG for weekly data...")
    weekly_rrg = compute_rrg_series(weekly_df, NSE_SECTORS, BENCHMARK)
    
    # Create payload
    payload = {
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "benchmark": BENCHMARK,
        "daily": daily_rrg,
        "weekly": weekly_rrg,
        "summary": {
            "total_sectors": len(NSE_SECTORS),
            "sectors_computed_daily": len(daily_rrg),
            "sectors_computed_weekly": len(weekly_rrg)
        }
    }
    
    # Write to JSON
    with open("data.json", "w") as f:
        json.dump(payload, f, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ Successfully generated data.json")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  Daily RRG:  {len(daily_rrg)} sectors")
    print(f"  Weekly RRG: {len(weekly_rrg)} sectors")
    print(f"  Benchmark: {BENCHMARK}")
    print(f"  Timestamp: {payload['last_updated']}")


if __name__ == "__main__":
    main()
