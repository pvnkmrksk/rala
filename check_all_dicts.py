#!/usr/bin/env python3
"""
Check all dictionaries - get expected counts and compare with actual file counts
"""

import os
import glob
from scraper import get_all_dictionaries, DictionaryScraper
import time

def get_expected_count(scraper, dict_name):
    """Get expected count from the website for a dictionary"""
    try:
        scraper.navigate_to_dictionary()
        scraper.select_dictionary(dict_name)
        scraper.set_pagination(200)
        
        # Wait for table to load
        time.sleep(3)
        
        # Get total records from DataTables info
        records_total = scraper.driver.execute_script("""
            var table = jQuery('#myTable10').DataTable();
            if (table) {
                var info = table.page.info();
                return info.recordsTotal;
            }
            return null;
        """)
        
        return records_total
    except Exception as e:
        print(f"  Error getting count for {dict_name[:50]}: {e}")
        return None

def get_file_count(filename):
    """Get entry count from CSV file"""
    csv_file = f"{filename}.csv"
    if os.path.exists(csv_file):
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                return len(lines) - 1  # Subtract header
        except:
            return None
    return None

def sanitize_filename(dict_name):
    """Convert dictionary name to filename"""
    safe_name = "".join(c for c in dict_name[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name.replace(' ', '_').replace('|', '_').replace('/', '_')
    return safe_name

def main():
    print("=" * 100)
    print("DICTIONARY COMPLETENESS CHECK")
    print("=" * 100)
    
    # Get all dictionaries
    print("\n1. Fetching dictionary list...")
    all_dicts = get_all_dictionaries()
    print(f"   Found {len(all_dicts)} English-Kannada dictionaries")
    
    # Get expected counts from website
    print("\n2. Getting expected counts from website...")
    print("   (This will take a while - checking each dictionary)")
    
    scraper = DictionaryScraper(headless=True)
    results = []
    
    try:
        for i, dict_info in enumerate(all_dicts, 1):
            dict_name = dict_info['text']
            filename = sanitize_filename(dict_name)
            file_count = get_file_count(filename)
            
            print(f"\n[{i}/{len(all_dicts)}] {dict_name[:60]}...")
            print(f"    File: {filename[:50]}.csv")
            print(f"    Current file count: {file_count if file_count is not None else 'NOT FOUND'}")
            
            expected_count = get_expected_count(scraper, dict_name)
            
            if expected_count:
                print(f"    Expected count: {expected_count}")
                status = "✓ COMPLETE" if file_count == expected_count else "⚠️ INCOMPLETE" if file_count and file_count < expected_count else "❌ MISSING"
                print(f"    Status: {status}")
            else:
                print(f"    Expected count: Could not retrieve")
                status = "❓ UNKNOWN"
            
            results.append({
                'name': dict_name,
                'filename': filename,
                'expected': expected_count,
                'actual': file_count,
                'status': status
            })
            
            # Small delay between dictionaries
            time.sleep(1)
    finally:
        scraper.close()
    
    # Print summary
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    
    complete = [r for r in results if r['status'] == '✓ COMPLETE']
    incomplete = [r for r in results if r['status'] == '⚠️ INCOMPLETE']
    missing = [r for r in results if r['status'] == '❌ MISSING']
    unknown = [r for r in results if r['status'] == '❓ UNKNOWN']
    
    print(f"\n✓ Complete: {len(complete)}")
    print(f"⚠️  Incomplete: {len(incomplete)}")
    print(f"❌ Missing: {len(missing)}")
    print(f"❓ Unknown: {len(unknown)}")
    
    if incomplete:
        print("\n" + "=" * 100)
        print("INCOMPLETE DICTIONARIES:")
        print("=" * 100)
        for r in incomplete:
            print(f"\n{r['name'][:70]}")
            print(f"  File: {r['filename']}.csv")
            print(f"  Expected: {r['expected']}")
            print(f"  Actual: {r['actual']}")
            print(f"  Missing: {r['expected'] - r['actual']} entries")
    
    # Save to file
    with open('dictionary_status.txt', 'w', encoding='utf-8') as f:
        f.write("=" * 100 + "\n")
        f.write("DICTIONARY COMPLETENESS REPORT\n")
        f.write("=" * 100 + "\n\n")
        for r in results:
            f.write(f"{r['name']}\n")
            f.write(f"  File: {r['filename']}.csv\n")
            f.write(f"  Expected: {r['expected']}\n")
            f.write(f"  Actual: {r['actual']}\n")
            f.write(f"  Status: {r['status']}\n")
            if r['expected'] and r['actual']:
                f.write(f"  Missing: {r['expected'] - r['actual']} entries\n")
            f.write("\n")
    
    print(f"\n✓ Full report saved to dictionary_status.txt")

if __name__ == "__main__":
    main()

