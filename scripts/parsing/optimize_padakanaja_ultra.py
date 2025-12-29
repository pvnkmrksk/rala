#!/usr/bin/env python3
"""
Ultra-compact format for padakanaja dictionary:
1. Remove duplicates
2. Flatten structure: {source|dict_title: [[k, e, t?], ...]}
3. Use compact JSON (no spaces)
"""

import json
from pathlib import Path
from collections import defaultdict


def optimize_padakanaja(input_file, output_file):
    """Create ultra-compact format with duplicates removed."""
    print(f"Loading: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    original_size = len(json.dumps(data, ensure_ascii=False))
    print(f"Original size: {original_size / 1024 / 1024:.2f} MB")
    
    # Build compact format and remove duplicates
    compact = {}
    seen_entries = set()
    duplicates = 0
    total_entries = 0
    
    for source, dicts in data.items():
        for dict_title, entries in dicts.items():
            # Flatten key: source|dict_title
            key = f"{source}|{dict_title}"
            compact_entries = []
            
            for entry in entries:
                total_entries += 1
                # Normalize entry: ensure consistent format
                if len(entry) == 3:
                    entry_tuple = (entry[0].strip(), entry[1].strip(), entry[2].strip() if entry[2] else '')
                elif len(entry) == 2:
                    entry_tuple = (entry[0].strip(), entry[1].strip(), '')
                else:
                    continue
                
                # Skip empty entries
                if not entry_tuple[0] or not entry_tuple[1]:
                    continue
                
                # Check for duplicates
                if entry_tuple in seen_entries:
                    duplicates += 1
                    continue
                
                seen_entries.add(entry_tuple)
                # Store as list (will be converted to array in JSON)
                if entry_tuple[2]:
                    compact_entries.append([entry_tuple[0], entry_tuple[1], entry_tuple[2]])
                else:
                    compact_entries.append([entry_tuple[0], entry_tuple[1]])
            
            if compact_entries:
                compact[key] = compact_entries
    
    # Save ultra-compact format (no spaces, no indentation)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(compact, f, ensure_ascii=False, separators=(',', ':'))
    
    compact_size = Path(output_file).stat().st_size
    reduction = (1 - compact_size / original_size) * 100
    
    print(f"\nOptimization results:")
    print(f"  Total entries processed: {total_entries:,}")
    print(f"  Duplicates removed: {duplicates:,} ({duplicates/total_entries*100:.1f}%)")
    print(f"  Unique entries: {len(seen_entries):,}")
    print(f"  Compact size: {compact_size / 1024 / 1024:.2f} MB")
    print(f"  Reduction: {reduction:.1f}%")
    print(f"  Saved: {(original_size - compact_size) / 1024 / 1024:.2f} MB")
    
    return compact


if __name__ == '__main__':
    input_file = 'padakanaja/combined_dictionaries_part1.json'
    output_file = 'padakanaja/combined_dictionaries_ultra.json'
    
    optimize_padakanaja(input_file, output_file)
    print(f"\n✓ Saved ultra-compact format to: {output_file}")


