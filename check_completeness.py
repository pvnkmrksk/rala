#!/usr/bin/env python3
"""
Check completeness of scraped dictionaries
Identifies dictionaries that might be incomplete (stopped after first page)
"""

import os
import glob

def check_dictionaries():
    """Check all CSV files for completeness"""
    csv_files = glob.glob("*.csv")
    
    if not csv_files:
        print("No CSV files found!")
        return
    
    print(f"Found {len(csv_files)} CSV files\n")
    print("=" * 80)
    print("SUSPICIOUS FILES (likely incomplete):")
    print("=" * 80)
    
    suspicious = []
    complete = []
    very_small = []
    
    for csv_file in sorted(csv_files):
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                entry_count = len(lines) - 1  # Subtract header
            
            # Check if suspicious
            if entry_count == 200:
                suspicious.append((csv_file, entry_count, "Exactly 200 entries (one page)"))
            elif entry_count < 20:
                very_small.append((csv_file, entry_count, "Very small (might be complete)"))
            elif entry_count > 500:
                complete.append((csv_file, entry_count, "Large (likely complete)"))
        except Exception as e:
            print(f"Error reading {csv_file}: {e}")
    
    # Print suspicious files
    if suspicious:
        print(f"\n⚠️  {len(suspicious)} files with exactly 200 entries (likely stopped after first page):")
        for filename, count, reason in suspicious:
            print(f"  {count:4d} entries - {filename[:60]}")
    
    if very_small:
        print(f"\n📝 {len(very_small)} very small files (might be complete small dictionaries):")
        for filename, count, reason in very_small[:10]:  # Show first 10
            print(f"  {count:4d} entries - {filename[:60]}")
    
    print("\n" + "=" * 80)
    print("STATISTICS:")
    print("=" * 80)
    
    all_counts = []
    for csv_file in csv_files:
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                entry_count = len(f.readlines()) - 1
                all_counts.append(entry_count)
        except:
            pass
    
    if all_counts:
        all_counts.sort()
        print(f"Total files: {len(all_counts)}")
        print(f"Total entries: {sum(all_counts):,}")
        print(f"Average entries per file: {sum(all_counts) / len(all_counts):.1f}")
        print(f"Min entries: {min(all_counts)}")
        print(f"Max entries: {max(all_counts)}")
        print(f"Median entries: {all_counts[len(all_counts)//2]}")
        print(f"\nFiles with exactly 200 entries: {sum(1 for c in all_counts if c == 200)}")
        print(f"Files with < 50 entries: {sum(1 for c in all_counts if c < 50)}")
        print(f"Files with > 1000 entries: {sum(1 for c in all_counts if c > 1000)}")
    
    print("\n" + "=" * 80)
    print("RECOMMENDATION:")
    print("=" * 80)
    print("Files with exactly 200 entries likely stopped after the first page.")
    print("These should be re-scraped. The pagination logic may have failed.")
    print("\nTo re-scrape a specific dictionary:")
    print('  python scraper.py --dictionary "..." --output filename')

if __name__ == "__main__":
    check_dictionaries()

