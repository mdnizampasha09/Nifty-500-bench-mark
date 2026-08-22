import os
import json
import numpy as np
import pandas as pd
import yfinance as yf

def calculate_rrg(sectors, benchmark_symbol, window_ratio=14, window_mom=14, tail_length=4):
    # Fetch historical daily data for the past 6 months to calculate smooth moving averages
    tickers = sectors + [benchmark_symbol]
    data = yf.download(tickers, period="6mo", interval="1d")['Close']
    
    # Clean column mapping formatting
    data.columns = [col.replace('.NS', '') for col in data.columns]
    bench_clean = benchmark_symbol.replace('.NS', '')
    
    output_sectors = []
    
    for sector in sectors:
        sec_clean = sector.replace('.NS', '')
        
        # 1. Raw Relative Strength Line
        raw_rs = (data[sec_clean] / data[bench_clean]) * 100
        
        # 2. Compute RS-Ratio (Normalized EMA)
        ema_rs = raw_rs.ewm(span=window_ratio, adjust=False).mean()
        std_rs = raw_rs.rolling(window=window_ratio).std()
        # Avoid division by zero bugs
        std_rs = std_rs.replace(0, np.nan).bfill()
        rs_ratio = 100 + ((raw_rs - ema_rs) / std_rs)
        
        # 3. Compute RS-Momentum (Rate of Change of RS-Ratio)
        rs_mom_raw = rs_ratio.pct_change(periods=window_mom) * 100
        ema_mom = rs_mom_raw.ewm(span=window_mom, adjust=False).mean()
        std_mom = rs_mom_raw.rolling(window=window_mom).std()
        std_mom = std_mom.replace(0, np.nan).bfill()
        rs_momentum = 100 + ((rs_mom_raw - ema_mom) / std_mom)
        
        # Combine metrics into a single structural matrix
        df_rrg = pd.DataFrame({'x': rs_ratio, 'y': rs_momentum}).dropna()
        
        # Extract the trailing data points
        trail_points = df_rrg.tail(tail_length).to_dict(orient='records')
        
        # Define current mathematical quadrant quadrant location
        latest = trail_points[-1]
        if latest['x'] >= 100 and latest['y'] >= 100:
            quadrant = "Leading"
        elif latest['x'] >= 100 and latest['y'] < 100:
            quadrant = "Weakening"
        elif latest['x'] < 100 and latest['y'] < 100:
            quadrant = "Lagging"
        else:
            quadrant = "Improving"
            
        output_sectors.append({
            "name": sec_clean,
            "quadrant": quadrant,
            "trail": [{ "x": round(p['x'], 2), "y": round(p['y'], 2) } for p in trail_points]
        })
        
    return output_sectors

if __name__ == "__main__":
    # Primary Indian Sector Indexes tracked via Yahoo Finance tickers
    nse_sectors = [
        "^CNXBANK",     # Nifty Bank
        "^CNXIT",       # Nifty IT
        "^CNXAUTO",     # Nifty Auto
        "^CNXFMCG",     # Nifty FMCG
        "^CNXREALTY",   # Nifty Realty
        "^CNXINFRA"     # Nifty Infra
    ]
    # Nifty 500 Index Benchmark Target
    benchmark = "^CRSLDX" 
    
    print("Fetching and executing mathematical JdK matrices...")
    result_data = calculate_rrg(nse_sectors, benchmark)
    
    # Write cleanly to file system
    with open("data.json", "w") as f:
        json.dump(result_data, f, indent=4)
    print("Successfully compiled and outputted to data.json!")
