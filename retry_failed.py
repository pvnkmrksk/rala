#!/usr/bin/env python3
"""
Retry failed/incomplete dictionaries
"""

import json
import subprocess
import sys
import os

def main():
    if not os.path.exists('expected_counts.json'):
        print("❌ expected_counts.json not found. Run get_expected_counts.py first")
        return
    
    with open('expected_counts.json', 'r', encoding='utf-8') as f:
        expected = json.load(f)
    
    # Get file counts
    def get_file_count(filename):
        csv = f"{filename}.csv"
        if os.path.exists(csv):
            try:
                with open(csv, 'r', encoding='utf-8') as f:
                    return len(f.readlines()) - 1
            except:
                return None
        return None
    
    # Find incomplete and missing dictionaries
    to_retry = []
    
    for item in expected:
        name = item['name']
        filename = item['filename']
        expected_count = item.get('expected')
        actual_count = item.get('actual') or get_file_count(filename)
        
        if expected_count:
            if actual_count is None or actual_count < expected_count:
                to_retry.append({
                    'name': name,
                    'filename': filename,
                    'expected': expected_count,
                    'actual': actual_count or 0,
                    'missing': expected_count - (actual_count or 0)
                })
    
    print(f"Found {len(to_retry)} dictionaries to retry")
    print(f"\nTop 10 by missing count:")
    for item in sorted(to_retry, key=lambda x: x['missing'], reverse=True)[:10]:
        print(f"  - {item['name'][:60]}: {item['actual']}/{item['expected']} (missing {item['missing']})")
    
    # Process in batches
    batch_size = 3
    batches = [to_retry[i:i+batch_size] for i in range(0, len(to_retry), batch_size)]
    
    print(f"\nProcessing {len(to_retry)} dictionaries in {len(batches)} batches...")
    
    for batch_num, batch in enumerate(batches, 1):
        print(f"\n{'='*80}")
        print(f"BATCH {batch_num}/{len(batches)}")
        print(f"{'='*80}")
        
        processes = []
        for item in batch:
            print(f"\n[{batch.index(item) + 1}/{len(batch)}] {item['name'][:60]}...")
            print(f"    Expected: {item['expected']}, Current: {item['actual']}, Missing: {item['missing']}")
            
            cmd = [
                sys.executable,
                'scraper.py',
                '--dictionary', item['name'],
                '--output', item['filename']
            ]
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            processes.append({
                'process': process,
                'item': item
            })
            
            print(f"    → PID: {process.pid}")
        
        # Wait for batch
        print(f"\n⏳ Waiting for batch {batch_num}...")
        for proc_info in processes:
            proc_info['process'].wait()
            item = proc_info['item']
            
            if proc_info['process'].returncode == 0:
                # Check if it improved
                new_count = get_file_count(item['filename'])
                if new_count and new_count >= item['expected']:
                    print(f"  ✅ {item['name'][:50]} - COMPLETE ({new_count}/{item['expected']})")
                elif new_count and new_count > item['actual']:
                    print(f"  ⚠️  {item['name'][:50]} - IMPROVED ({item['actual']} → {new_count}/{item['expected']})")
                else:
                    print(f"  ⚠️  {item['name'][:50]} - NO CHANGE ({new_count or item['actual']}/{item['expected']})")
            else:
                stderr = proc_info['process'].stderr.read() if proc_info['process'].stderr else ""
                print(f"  ❌ {item['name'][:50]} - FAILED")
                if stderr:
                    print(f"     Error: {stderr[:200]}")
        
        if batch_num < len(batches):
            print(f"\n⏸️  Waiting 10 seconds before next batch...")
            import time
            time.sleep(10)

if __name__ == "__main__":
    main()

