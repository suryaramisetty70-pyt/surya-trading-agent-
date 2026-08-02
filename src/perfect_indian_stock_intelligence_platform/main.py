#!/usr/bin/env python
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from perfect_indian_stock_intelligence_platform.crew import PerfectIndianStockIntelligencePlatformCrew

def run():
    """
    Run the crew with dynamic stock ticker and multi-language support.
    """
    ticker = 'RELIANCE'
    language = 'English'
    
    if len(sys.argv) >= 3:
        ticker = sys.argv[2]
    if len(sys.argv) >= 4:
        language = sys.argv[3]

    print(f"\n🚀 Launching Perfect Indian Stock Intelligence Platform for Ticker: {ticker} (Language: {language})...\n")
    inputs = {
        'indian_stock_ticker': ticker,
        'report_language': language
    }
    
    # Ensure output directory exists
    os.makedirs("output", exist_ok=True)
    
    result = PerfectIndianStockIntelligencePlatformCrew().crew().kickoff(inputs=inputs)
    print("\n✅ Analysis Complete! Report saved to output/master_investment_report.md\n")

if __name__ == "__main__":
    run()
