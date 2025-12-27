#!/usr/bin/env python3
"""
Re-scrape dictionaries that appear to be incomplete (exactly 200 entries)
"""

import subprocess
import sys
import os
import glob
from scraper import get_all_dictionaries

def find_incomplete_dictionaries():
    """Find dictionaries with exactly 200 entries"""
    incomplete = []
    csv_files = glob.glob("*.csv")
    
    for csv_file in csv_files:
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                entry_count = len(f.readlines()) - 1
                if entry_count == 200:
                    incomplete.append(csv_file)
        except:
            pass
    
    return incomplete

def get_dictionary_name_from_file(filename):
    """Try to match filename to dictionary name"""
    # Remove extension and try to match
    base_name = filename.replace('.csv', '').replace('.json', '')
    # This is tricky since filenames are sanitized
    # We'll need to get the list and match somehow
    return None

def main():
    print("Finding incomplete dictionaries (exactly 200 entries)...")
    incomplete_files = find_incomplete_dictionaries()
    
    if not incomplete_files:
        print("No incomplete dictionaries found!")
        return
    
    print(f"\nFound {len(incomplete_files)} potentially incomplete dictionaries:")
    for i, f in enumerate(incomplete_files[:10], 1):  # Show first 10
        print(f"  {i}. {f}")
    
    if len(incomplete_files) > 10:
        print(f"  ... and {len(incomplete_files) - 10} more")
    
    print("\n" + "="*80)
    print("To re-scrape these, you need to:")
    print("1. Get the dictionary name: python scraper.py --list")
    print("2. Re-scrape: python scraper.py --dictionary '...' --output filename")
    print("\nOr manually check each one to see if it's actually complete.")
    print("Some dictionaries might genuinely have only 200 entries.")

if __name__ == "__main__":
    main()

