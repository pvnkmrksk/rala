#!/usr/bin/env python3
"""
Process all incomplete dictionaries one at a time
Skips dictionaries that fail repeatedly
"""

import json
import os
import sys
import time
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
        filename = item.get('filename') or sanitize_filename(name)
        expected_count = item.get('expected')
        actual_count = item.get('actual') or get_file_count(filename)
        
        if expected_count and (actual_count is None or actual_count < expected_count):
            incomplete.append({
                'name': name,
                'filename': filename,
                'expected': expected_count,
                'actual': actual_count or 0,
                'missing': expected_count - (actual_count or 0),
                'failures': 0  # Track consecutive failures
            })
    
    if not incomplete:
        print("✅ All dictionaries are complete!")
        return
    
    # Sort by missing count (largest first)
    incomplete.sort(key=lambda x: x['missing'], reverse=True)
    
    print("=" * 80)
    print(f"PROCESSING {len(incomplete)} INCOMPLETE DICTIONARIES")
    print("=" * 80)
    print(f"Will skip dictionaries that fail 2 times in a row")
    print("=" * 80)
    print()
    
    success_count = 0
    improved_count = 0
    skipped_count = 0
    fail_count = 0
    max_failures = 2  # Skip after 2 consecutive failures
    
    for i, item in enumerate(incomplete, 1):
        print("\n" + "=" * 80)
        print(f"DICTIONARY {i}/{len(incomplete)}")
        print("=" * 80)
        print(f"Name: {item['name']}")
        print(f"Expected: {item['expected']:,} entries")
        print(f"Current: {item['actual']:,} entries")
        print(f"Missing: {item['missing']:,} entries")
        print(f"Previous failures: {item['failures']}")
        print("=" * 80)
        print()
        
        # Skip if too many failures
        if item['failures'] >= max_failures:
            print(f"⏭️  SKIPPING: Has failed {item['failures']} times, will retry later")
            skipped_count += 1
            continue
        
        try:
            # Attempt to scrape
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
                    item['failures'] = 0  # Reset failure count
                elif new_count and new_count > item['actual']:
                    improvement = new_count - item['actual']
                    print(f"\n⚠️  IMPROVED: {item['actual']:,} → {new_count:,}/{item['expected']:,} entries (+{improvement:,})")
                    improved_count += 1
                    item['actual'] = new_count  # Update count
                    item['missing'] = item['expected'] - new_count
                    item['failures'] = 0  # Reset failure count
                else:
                    print(f"\n⚠️  NO CHANGE: {new_count or item['actual']:,}/{item['expected']:,} entries")
                    item['failures'] += 1
                    fail_count += 1
            else:
                print(f"\n❌ FAILED: Scraping returned False")
                item['failures'] += 1
                fail_count += 1
                
        except KeyboardInterrupt:
            print("\n\n⚠️  Interrupted by user")
            print("\nProgress so far:")
            print(f"  ✅ Complete: {success_count}")
            print(f"  ⚠️  Improved: {improved_count}")
            print(f"  ❌ Failed: {fail_count}")
            print(f"  ⏭️  Skipped: {skipped_count}")
            break
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            item['failures'] += 1
            fail_count += 1
            import traceback
            traceback.print_exc()
        
        # Show summary
        print(f"\n📊 Progress: {i}/{len(incomplete)} dictionaries processed")
        print(f"   ✅ Complete: {success_count} | ⚠️  Improved: {improved_count} | ❌ Failed: {fail_count} | ⏭️  Skipped: {skipped_count}")
        
        # Wait before next dictionary (except for last one)
        if i < len(incomplete):
            print("\n⏸️  Waiting 3 seconds before next dictionary...")
            time.sleep(3)
    
    # Final summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    print(f"✅ Complete: {success_count}")
    print(f"⚠️  Improved: {improved_count}")
    print(f"❌ Failed: {fail_count}")
    print(f"⏭️  Skipped: {skipped_count}")
    print(f"Total processed: {len(incomplete)}")
    print("=" * 80)
    
    # List skipped dictionaries for later retry
    skipped = [item for item in incomplete if item['failures'] >= max_failures]
    if skipped:
        print(f"\n⏭️  SKIPPED DICTIONARIES (to retry later):")
        for item in skipped:
            print(f"  - {item['name'][:60]}")
            print(f"    Expected: {item['expected']:,}, Current: {item['actual']:,}, Missing: {item['missing']:,}")

if __name__ == "__main__":
    main()

