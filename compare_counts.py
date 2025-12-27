#!/usr/bin/env python3
"""
Compare expected vs actual counts for all dictionaries
Reads from expected_counts.json if it exists, otherwise prompts to create it
"""

import os
import json
import glob

def get_file_count(filename):
    """Get entry count from CSV"""
    csv = f"{filename}.csv"
    if os.path.exists(csv):
        try:
            with open(csv, 'r', encoding='utf-8') as f:
                return len(f.readlines()) - 1
        except:
            return None
    return None

def main():
    # Check if expected_counts.json exists
    if not os.path.exists('expected_counts.json'):
        print("expected_counts.json not found.")
        print("Run: python get_expected_counts.py")
        return
    
    with open('expected_counts.json', 'r', encoding='utf-8') as f:
        expected = json.load(f)
    
    print("=" * 100)
    print("DICTIONARY COUNT COMPARISON")
    print("=" * 100)
    
    incomplete = []
    complete = []
    missing = []
    
    for item in expected:
        name = item['name']
        filename = item['filename']
        expected_count = item.get('expected')
        actual_count = get_file_count(filename)
        
        if expected_count:
            if actual_count is None:
                missing.append(item)
            elif actual_count < expected_count:
                incomplete.append({
                    **item,
                    'actual': actual_count,
                    'missing': expected_count - actual_count
                })
            elif actual_count == expected_count:
                complete.append(item)
    
    print(f"\n✓ Complete: {len(complete)}")
    print(f"⚠️  Incomplete: {len(incomplete)}")
    print(f"❌ Missing: {len(missing)}")
    
    if incomplete:
        print("\n" + "=" * 100)
        print("INCOMPLETE DICTIONARIES (sorted by missing count):")
        print("=" * 100)
        for item in sorted(incomplete, key=lambda x: x['missing'], reverse=True):
            print(f"\n{item['name'][:70]}")
            print(f"  File: {item['filename']}.csv")
            print(f"  Expected: {item['expected']}")
            print(f"  Actual: {item['actual']}")
            print(f"  Missing: {item['missing']} entries")
            # Calculate which page it likely stopped at (assuming 200 per page)
            if item['actual']:
                stopped_at_page = (item['actual'] // 200) + 1
                print(f"  Likely stopped at: Page {stopped_at_page}")

if __name__ == "__main__":
    main()

