#!/usr/bin/env python3
"""
Retry incomplete dictionaries one at a time using the clean scraper
"""

import json
import os
import sys
from scraper_clean import scrape_single_dictionary

def get_file_count(filename):
    """Get entry count from CSV"""
    csv_file = f"{filename}.csv"
    if os.path.exists(csv_file):
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                return len(f.readlines()) - 1
        except:
            return None
    return None

def sanitize_filename(name):
    """Convert dictionary name to filename"""
    safe = "".join(c for c in name[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
    return safe.replace(' ', '_').replace('|', '_').replace('/', '_')

def main():
    if not os.path.exists('expected_counts.json'):
        print("❌ expected_counts.json not found. Run get_expected_counts.py first")
        return
    
    with open('expected_counts.json', 'r', encoding='utf-8') as f:
        expected = json.load(f)
    
    # Find incomplete dictionaries
    incomplete = []
    
    for item in expected:
        name = item['name']
        filename = item['filename']
        expected_count = item.get('expected')
        actual_count = item.get('actual') or get_file_count(filename)
        
        if expected_count and (actual_count is None or actual_count < expected_count):
            incomplete.append({
                'name': name,
                'filename': filename or sanitize_filename(name),
                'expected': expected_count,
                'actual': actual_count or 0,
                'missing': expected_count - (actual_count or 0)
            })
    
    if not incomplete:
        print("✅ All dictionaries are complete!")
        return
    
    print("=" * 80)
    print(f"FOUND {len(incomplete)} INCOMPLETE DICTIONARIES")
    print("=" * 80)
    
    # Sort by missing count (largest first)
    incomplete.sort(key=lambda x: x['missing'], reverse=True)
    
    print("\nTop 10 to retry:")
    for i, item in enumerate(incomplete[:10], 1):
        print(f"  {i}. {item['name'][:60]}")
        print(f"     Expected: {item['expected']:,}, Current: {item['actual']:,}, Missing: {item['missing']:,}")
    
    print(f"\n\nProcessing {len(incomplete)} dictionaries one at a time...")
    print("=" * 80)
    
    success_count = 0
    fail_count = 0
    
    for i, item in enumerate(incomplete, 1):
        print("\n" + "=" * 80)
        print(f"DICTIONARY {i}/{len(incomplete)}")
        print("=" * 80)
        print(f"Name: {item['name']}")
        print(f"Expected: {item['expected']:,} entries")
        print(f"Current: {item['actual']:,} entries")
        print(f"Missing: {item['missing']:,} entries")
        print("=" * 80)
        print()
        
        try:
            success = scrape_single_dictionary(
                item['name'],
                item['filename'],
                headless=False  # Show browser for debugging
            )
            
            if success:
                # Check if it improved
                new_count = get_file_count(item['filename'])
                if new_count and new_count >= item['expected']:
                    print(f"\n✅ COMPLETE: {new_count:,}/{item['expected']:,} entries")
                    success_count += 1
                elif new_count and new_count > item['actual']:
                    print(f"\n⚠️  IMPROVED: {item['actual']:,} → {new_count:,}/{item['expected']:,} entries")
                    success_count += 1
                else:
                    print(f"\n⚠️  NO CHANGE: {new_count or item['actual']:,}/{item['expected']:,} entries")
                    fail_count += 1
            else:
                print(f"\n❌ FAILED")
                fail_count += 1
        except KeyboardInterrupt:
            print("\n\n⚠️  Interrupted by user")
            break
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            fail_count += 1
            import traceback
            traceback.print_exc()
        
        if i < len(incomplete):
            print("\n⏸️  Waiting 5 seconds before next dictionary...")
            import time
            time.sleep(5)
    
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"✅ Success: {success_count}")
    print(f"❌ Failed: {fail_count}")
    print(f"Total: {len(incomplete)}")

if __name__ == "__main__":
    main()

