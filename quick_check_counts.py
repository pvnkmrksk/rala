#!/usr/bin/env python3
"""
Quick check: Get expected counts from website and compare with file counts
"""

import os
import glob
from scraper import get_all_dictionaries, DictionaryScraper
import time

def get_expected_count_from_website(dict_name):
    """Get expected count from website for a dictionary"""
    scraper = DictionaryScraper(headless=True)
    try:
        scraper.navigate_to_dictionary()
        scraper.select_dictionary(dict_name)
        scraper.set_pagination(200)
        
        # Wait for table to load
        time.sleep(3)
        
        # Get total records from the info element
        records_total = scraper.driver.execute_script("""
            // Try multiple methods to get the count
            var count = null;
            
            // Method 1: DataTables API
            var table = jQuery('#myTable10').DataTable();
            if (table) {
                var info = table.page.info();
                count = info.recordsTotal;
            }
            
            // Method 2: From the info element text
            if (!count) {
                var infoEl = document.querySelector('#myTable10_info');
                if (infoEl) {
                    var text = infoEl.textContent || infoEl.innerText;
                    // Extract number from "Showing 1 to 200 of 5000 entries"
                    var match = text.match(/of\\s+(\\d+)/);
                    if (match) {
                        count = parseInt(match[1]);
                    }
                }
            }
            
            return count;
        """)
        
        return records_total
    except Exception as e:
        print(f"    Error: {e}")
        return None
    finally:
        scraper.close()

def get_file_count(filename):
    """Get entry count from CSV file"""
    csv_file = f"{filename}.csv"
    if os.path.exists(csv_file):
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                return len(f.readlines()) - 1  # Subtract header
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
    print("QUICK DICTIONARY COUNT CHECK")
    print("=" * 100)
    
    # Get all dictionaries
    print("\nFetching dictionary list...")
    all_dicts = get_all_dictionaries()
    print(f"Found {len(all_dicts)} dictionaries\n")
    
    results = []
    
    for i, dict_info in enumerate(all_dicts, 1):
        dict_name = dict_info['text']
        filename = sanitize_filename(dict_name)
        file_count = get_file_count(filename)
        
        print(f"[{i}/{len(all_dicts)}] {dict_name[:70]}")
        print(f"  File: {filename[:50]}.csv")
        print(f"  Current: {file_count if file_count is not None else 'NOT FOUND'}", end="")
        
        expected = get_expected_count_from_website(dict_name)
        
        if expected:
            print(f" | Expected: {expected}", end="")
            if file_count:
                if file_count == expected:
                    print(" ✓")
                    status = "COMPLETE"
                elif file_count < expected:
                    missing = expected - file_count
                    print(f" ⚠️  MISSING {missing}")
                    status = f"INCOMPLETE (-{missing})"
                else:
                    print(f" ⚠️  EXTRA {file_count - expected}")
                    status = f"EXTRA (+{file_count - expected})"
            else:
                print(" ❌")
                status = "MISSING"
        else:
            print(" ❓ Could not get expected count")
            status = "UNKNOWN"
        
        results.append({
            'name': dict_name,
            'filename': filename,
            'expected': expected,
            'actual': file_count,
            'status': status
        })
        
        time.sleep(0.5)  # Small delay
    
    # Print summary
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    
    incomplete = [r for r in results if 'INCOMPLETE' in r['status']]
    missing = [r for r in results if r['status'] == 'MISSING']
    complete = [r for r in results if r['status'] == 'COMPLETE']
    
    print(f"\n✓ Complete: {len(complete)}")
    print(f"⚠️  Incomplete: {len(incomplete)}")
    print(f"❌ Missing: {len(missing)}")
    
    if incomplete:
        print("\n" + "=" * 100)
        print("INCOMPLETE DICTIONARIES:")
        print("=" * 100)
        for r in sorted(incomplete, key=lambda x: x['expected'] - (x['actual'] or 0), reverse=True):
            print(f"\n{r['name'][:70]}")
            print(f"  File: {r['filename']}.csv")
            print(f"  Expected: {r['expected']}")
            print(f"  Actual: {r['actual']}")
            print(f"  Missing: {r['expected'] - (r['actual'] or 0)} entries")
            print(f"  Status: {r['status']}")

if __name__ == "__main__":
    main()

