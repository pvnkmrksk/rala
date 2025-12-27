#!/usr/bin/env python3
"""
Generate markdown report of dictionary counts
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
        print("❌ expected_counts.json not found.")
        print("Run: python get_expected_counts.py first")
        return
    
    with open('expected_counts.json', 'r', encoding='utf-8') as f:
        expected = json.load(f)
    
    # Get all CSV files to check
    csv_files = glob.glob("*.csv")
    all_files = {os.path.splitext(f)[0]: get_file_count(os.path.splitext(f)[0]) for f in csv_files}
    
    # Process results
    complete = []
    incomplete = []
    missing = []
    extra = []
    unknown = []
    
    for item in expected:
        name = item['name']
        filename = item['filename']
        expected_count = item.get('expected')
        actual_count = item.get('actual') or all_files.get(filename)
        
        if expected_count:
            if actual_count is None:
                missing.append({
                    **item,
                    'actual': None
                })
            elif actual_count < expected_count:
                incomplete.append({
                    **item,
                    'actual': actual_count,
                    'missing_count': expected_count - actual_count,
                    'percent': (actual_count / expected_count) * 100
                })
            elif actual_count == expected_count:
                complete.append(item)
            else:
                extra.append({
                    **item,
                    'actual': actual_count,
                    'extra': actual_count - expected_count
                })
        else:
            unknown.append({
                **item,
                'actual': actual_count
            })
    
    # Generate markdown report
    md_content = []
    md_content.append("# Dictionary Scraping Status Report\n")
    md_content.append(f"Generated: {os.popen('date').read().strip()}\n")
    
    # Summary
    md_content.append("## Summary\n")
    md_content.append(f"- ✅ **Complete**: {len(complete)} dictionaries\n")
    md_content.append(f"- ⚠️  **Incomplete**: {len(incomplete)} dictionaries\n")
    md_content.append(f"- ❌ **Missing**: {len(missing)} dictionaries\n")
    if extra:
        md_content.append(f"- ➕ **Extra entries**: {len(extra)} dictionaries\n")
    if unknown:
        md_content.append(f"- ❓ **Unknown expected count**: {len(unknown)} dictionaries\n")
    
    md_content.append(f"\n**Total dictionaries**: {len(expected)}\n")
    
    # Incomplete dictionaries
    if incomplete:
        md_content.append("\n## ⚠️ Incomplete Dictionaries\n")
        md_content.append("| Dictionary Name | Expected | Actual | Missing | % Complete | Status |\n")
        md_content.append("|-----------------|----------|--------|---------|------------|--------|\n")
        
        for item in sorted(incomplete, key=lambda x: x['missing_count'], reverse=True):
            name = item['name'][:60] + "..." if len(item['name']) > 60 else item['name']
            expected = item['expected']
            actual = item['actual']
            missing_count = item['missing_count']
            percent = item['percent']
            
            # Determine likely stopped page (assuming 200 per page)
            stopped_page = (actual // 200) + 1 if actual else 0
            
            status = f"Stopped at page ~{stopped_page}" if stopped_page > 0 else "Unknown"
            
            md_content.append(f"| {name} | {expected:,} | {actual:,} | {missing_count:,} | {percent:.1f}% | {status} |\n")
    
    # Missing dictionaries
    if missing:
        md_content.append("\n## ❌ Missing Dictionaries\n")
        md_content.append("| Dictionary Name | Expected | Status |\n")
        md_content.append("|-----------------|----------|--------|\n")
        
        for item in missing:
            name = item['name'][:60] + "..." if len(item['name']) > 60 else item['name']
            expected = item['expected']
            md_content.append(f"| {name} | {expected:,} | Not scraped |\n")
    
    # Complete dictionaries
    if complete:
        md_content.append("\n## ✅ Complete Dictionaries\n")
        md_content.append(f"**Total**: {len(complete)} dictionaries\n\n")
        md_content.append("| Dictionary Name | Count |\n")
        md_content.append("|-----------------|-------|\n")
        
        for item in sorted(complete, key=lambda x: x.get('expected', 0), reverse=True)[:20]:  # Show top 20
            name = item['name'][:60] + "..." if len(item['name']) > 60 else item['name']
            count = item.get('expected', 0)
            md_content.append(f"| {name} | {count:,} |\n")
        
        if len(complete) > 20:
            md_content.append(f"\n*... and {len(complete) - 20} more complete dictionaries*\n")
    
    # Extra entries (if any)
    if extra:
        md_content.append("\n## ➕ Dictionaries with Extra Entries\n")
        md_content.append("| Dictionary Name | Expected | Actual | Extra |\n")
        md_content.append("|-----------------|----------|--------|-------|\n")
        
        for item in extra:
            name = item['name'][:60] + "..." if len(item['name']) > 60 else item['name']
            expected = item['expected']
            actual = item['actual']
            extra_count = item['extra']
            md_content.append(f"| {name} | {expected:,} | {actual:,} | {extra_count:,} |\n")
    
    # Write to file
    with open('dictionary_status_report.md', 'w', encoding='utf-8') as f:
        f.write(''.join(md_content))
    
    print("✅ Report generated: dictionary_status_report.md")
    print(f"\nSummary:")
    print(f"  Complete: {len(complete)}")
    print(f"  Incomplete: {len(incomplete)}")
    print(f"  Missing: {len(missing)}")
    
    if incomplete:
        print(f"\n⚠️  Top 5 incomplete dictionaries:")
        for item in sorted(incomplete, key=lambda x: x['missing_count'], reverse=True)[:5]:
            print(f"  - {item['name'][:60]}: {item['actual']:,}/{item['expected']:,} (missing {item['missing_count']:,})")

if __name__ == "__main__":
    main()

