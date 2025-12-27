#!/usr/bin/env python3
"""
Run scraper for one dictionary at a time
Simple, clean execution
"""

import sys
import json
from scraper_clean import scrape_single_dictionary

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_one_dict.py <dictionary_name> [output_prefix]")
        print("\nExample:")
        print('  python run_one_dict.py "ಕೀಟಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ |ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ"')
        sys.exit(1)
    
    dictionary_name = sys.argv[1]
    output_prefix = sys.argv[2] if len(sys.argv) > 2 else None
    
    print("=" * 80)
    print("SCRAPING SINGLE DICTIONARY")
    print("=" * 80)
    print(f"Dictionary: {dictionary_name}")
    if output_prefix:
        print(f"Output: {output_prefix}.json/csv")
    print("=" * 80)
    print()
    
    success = scrape_single_dictionary(dictionary_name, output_prefix, headless=False)
    
    if success:
        print("\n✅ SUCCESS")
    else:
        print("\n❌ FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()

