#!/usr/bin/env python3
"""
Create an index that maps word prefixes to chunk numbers for efficient lookup
"""

import json
from pathlib import Path
from collections import defaultdict

def create_chunk_index():
    """Create index mapping word prefixes to chunk numbers"""
    base_dir = Path('padakanaja')
    
    # Load all chunk files and build index
    chunk_index = defaultdict(set)  # prefix -> set of chunk numbers
    
    print("Building chunk index...")
    for i in range(1, 22):  # 21 chunks
        chunk_file = base_dir / f"english_reverse_index_part{i}.json"
        if not chunk_file.exists():
            continue
        
        print(f"  Processing chunk {i}...")
        with open(chunk_file, 'r', encoding='utf-8') as f:
            chunk_data = json.load(f)
        
        # For each word in this chunk, add its prefixes to the index
        for word in chunk_data.keys():
            word_lower = word.lower()
            # Add first 1, 2, 3 characters as prefixes
            for prefix_len in [1, 2, 3]:
                if len(word_lower) >= prefix_len:
                    prefix = word_lower[:prefix_len]
                    chunk_index[prefix].add(i)
    
    # Convert sets to sorted lists for JSON
    chunk_index_json = {k: sorted(list(v)) for k, v in chunk_index.items()}
    
    # Save index
    index_file = base_dir / "chunk_index.json"
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(chunk_index_json, f, ensure_ascii=False, separators=(',', ':'))
    
    size_mb = index_file.stat().st_size / (1024 * 1024)
    print(f"✓ Created chunk index: {len(chunk_index_json):,} prefixes, {size_mb:.2f}MB")
    
    # Also create reverse: chunk -> word count (for stats)
    chunk_stats = {}
    for i in range(1, 22):
        chunk_file = base_dir / f"english_reverse_index_part{i}.json"
        if chunk_file.exists():
            with open(chunk_file, 'r', encoding='utf-8') as f:
                chunk_data = json.load(f)
            chunk_stats[i] = len(chunk_data)
    
    stats_file = base_dir / "chunk_stats.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(chunk_stats, f, indent=2)
    
    print(f"✓ Created chunk stats: {sum(chunk_stats.values()):,} total words")

if __name__ == '__main__':
    create_chunk_index()

