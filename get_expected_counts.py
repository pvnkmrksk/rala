#!/usr/bin/env python3
"""
Get expected counts for all dictionaries and save to file
Then compare with actual file counts
"""

import os
import json
from scraper import get_all_dictionaries, DictionaryScraper
import time

def get_expected_count(scraper, dict_name):
    """Get expected count from website"""
    try:
        scraper.navigate_to_dictionary()
        scraper.select_dictionary(dict_name)
        scraper.set_pagination(200)
        time.sleep(3)
        
        # Get from info element
        count = scraper.driver.execute_script("""
            var count = null;
            var table = jQuery('#myTable10').DataTable();
            if (table) {
                var info = table.page.info();
                count = info.recordsTotal;
            }
            if (!count) {
                var infoEl = document.querySelector('#myTable10_info');
                if (infoEl) {
                    var text = infoEl.textContent || infoEl.innerText;
                    var match = text.match(/of\\s+(\\d+)/);
                    if (match) count = parseInt(match[1]);
                }
            }
            return count;
        """)
        return count
    except:
        return None

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

def sanitize_filename(name):
    safe = "".join(c for c in name[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
    return safe.replace(' ', '_').replace('|', '_').replace('/', '_')

def main():
    print("Getting expected counts from website...")
    all_dicts = get_all_dictionaries()
    
    scraper = DictionaryScraper(headless=True)
    results = []
    
    try:
        for i, d in enumerate(all_dicts, 1):
            name = d['text']
            filename = sanitize_filename(name)
            file_count = get_file_count(filename)
            
            print(f"[{i}/{len(all_dicts)}] {name[:60]}...", end=" ")
            expected = get_expected_count(scraper, name)
            
            if expected:
                print(f"Expected: {expected}, File: {file_count or 'MISSING'}")
            else:
                print("Could not get count")
            
            results.append({
                'name': name,
                'filename': filename,
                'expected': expected,
                'actual': file_count
            })
            time.sleep(0.3)
    finally:
        scraper.close()
    
    # Save results
    with open('expected_counts.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # Print incomplete
    incomplete = [r for r in results if r['expected'] and r['actual'] and r['actual'] < r['expected']]
    print(f"\n\nFound {len(incomplete)} incomplete dictionaries:")
    for r in incomplete:
        print(f"  {r['name'][:60]}")
        print(f"    Expected: {r['expected']}, Actual: {r['actual']}, Missing: {r['expected'] - r['actual']}")
    
    print(f"\n✓ Saved to expected_counts.json")

if __name__ == "__main__":
    main()

