#!/usr/bin/env python3
"""
Automatically re-scrape all dictionaries that appear to be incomplete (exactly 200 entries)
"""

import subprocess
import sys
import os
import glob
import re
from scraper import get_all_dictionaries, scrape_single_dictionary

def find_incomplete_dictionaries():
    """Find dictionaries with exactly 200 entries"""
    incomplete = {}
    csv_files = glob.glob("*.csv")
    
    for csv_file in csv_files:
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                entry_count = len(f.readlines()) - 1
                if entry_count == 200:
                    # Extract base name (without extension)
                    base_name = csv_file.replace('.csv', '')
                    incomplete[base_name] = csv_file
        except Exception as e:
            print(f"Error reading {csv_file}: {e}")
    
    return incomplete

def match_filename_to_dictionary(incomplete_files, all_dicts):
    """Try to match incomplete filenames to dictionary names"""
    matches = []
    
    for base_name, csv_file in incomplete_files.items():
        # Try to find matching dictionary
        # The filename is sanitized, so we need to do fuzzy matching
        best_match = None
        best_score = 0
        
        for dict_info in all_dicts:
            dict_name = dict_info['text']
            # Create sanitized version similar to what scraper does
            sanitized = "".join(c for c in dict_name[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
            sanitized = sanitized.replace(' ', '_').replace('|', '_').replace('/', '_')
            
            # Simple matching: check if key parts match
            # Compare first 30 chars or so
            if sanitized[:30] == base_name[:30] or base_name[:30] in sanitized[:50]:
                score = len(set(sanitized[:30]) & set(base_name[:30]))
                if score > best_score:
                    best_score = score
                    best_match = dict_info
        
        if best_match:
            matches.append({
                'filename': csv_file,
                'base_name': base_name,
                'dictionary': best_match['text'],
                'match_score': best_score
            })
        else:
            print(f"⚠️  Could not match: {base_name}")
    
    return matches

def main():
    print("=" * 80)
    print("Re-scraping Incomplete Dictionaries")
    print("=" * 80)
    
    # Find incomplete files
    print("\n1. Finding incomplete dictionaries...")
    incomplete_files = find_incomplete_dictionaries()
    print(f"   Found {len(incomplete_files)} files with exactly 200 entries")
    
    if not incomplete_files:
        print("\n✓ No incomplete dictionaries found!")
        return
    
    # Get all dictionaries
    print("\n2. Fetching dictionary list...")
    all_dicts = get_all_dictionaries()
    print(f"   Found {len(all_dicts)} total dictionaries")
    
    # Match filenames to dictionary names
    print("\n3. Matching filenames to dictionary names...")
    matches = match_filename_to_dictionary(incomplete_files, all_dicts)
    print(f"   Matched {len(matches)}/{len(incomplete_files)} dictionaries")
    
    if not matches:
        print("\n⚠️  Could not match any filenames. Please re-scrape manually.")
        return
    
    # Process in batches of 8
    batch_size = 8
    total_batches = (len(matches) + batch_size - 1) // batch_size
    
    print(f"\n4. Re-scraping incomplete dictionaries (8 at a time)...")
    print(f"   Total: {len(matches)} dictionaries in {total_batches} batches")
    print("=" * 80)
    
    success_count = 0
    fail_count = 0
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(matches))
        batch = matches[start_idx:end_idx]
        
        print(f"\n{'='*80}")
        print(f"BATCH {batch_num + 1}/{total_batches} - Processing {len(batch)} dictionaries")
        print(f"{'='*80}")
        
        # Spawn processes for this batch
        processes = []
        for i, match in enumerate(batch, 1):
            dict_name = match['dictionary']
            output_name = match['base_name']
            
            print(f"\n[{start_idx + i}/{len(matches)}] Starting: {dict_name[:60]}...")
            print(f"    Output: {output_name}.json/csv")
            print(f"    Browser will be visible for debugging")
            
            # Spawn separate process
            cmd = [
                sys.executable,
                'scraper.py',
                '--dictionary', dict_name,
                '--output', output_name
                # Note: Not using --headless so browser is visible
            ]
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            processes.append({
                'process': process,
                'name': dict_name,
                'output': output_name,
                'match': match
            })
            
            print(f"    → Process PID: {process.pid}")
        
        # Wait for all processes in this batch to complete
        print(f"\n⏳ Waiting for batch {batch_num + 1} to complete...")
        for proc_info in processes:
            proc_info['process'].wait()
            if proc_info['process'].returncode == 0:
                success_count += 1
                print(f"  ✓ {proc_info['name'][:50]} - SUCCESS")
            else:
                fail_count += 1
                stderr = proc_info['process'].stderr.read() if proc_info['process'].stderr else "No error output"
                print(f"  ✗ {proc_info['name'][:50]} - FAILED")
                print(f"    Error: {stderr[:200]}")
        
        print(f"\nBatch {batch_num + 1} complete. Success: {success_count}, Failed: {fail_count}")
        
        # Wait a bit before next batch to avoid overwhelming the server
        if batch_num < total_batches - 1:
            print(f"\n⏸️  Waiting 10 seconds before next batch...")
            import time
            time.sleep(10)
    
    print("\n" + "=" * 80)
    print("FINAL SUMMARY:")
    print("=" * 80)
    print(f"Successfully re-scraped: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Total: {len(matches)}")
    
    if success_count > 0:
        print("\n✓ Re-scraping complete! Check the output files to verify completeness.")

if __name__ == "__main__":
    main()

