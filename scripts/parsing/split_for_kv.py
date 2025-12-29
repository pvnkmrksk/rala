#!/usr/bin/env python3
"""
Split large JSON files for Cloudflare KV (25MB limit per value)
"""

import json
from pathlib import Path

def split_json_file(input_file, output_prefix, max_size_mb=20):
    """Split a JSON file into chunks under max_size_mb"""
    input_path = Path(input_file)
    max_size_bytes = max_size_mb * 1024 * 1024
    
    print(f"Splitting {input_file} into chunks under {max_size_mb}MB...")
    
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, dict):
        items = list(data.items())
    elif isinstance(data, list):
        items = [(i, item) for i, item in enumerate(data)]
    else:
        print("Error: Unsupported JSON format")
        return
    
    chunks = []
    current_chunk = {}
    current_size = 2  # Start with "{}" size
    
    for key, value in items:
        # Estimate size of this item
        item_json = json.dumps({str(key): value}, ensure_ascii=False, separators=(',', ':'))
        item_size = len(item_json.encode('utf-8'))
        
        if current_size + item_size > max_size_bytes and current_chunk:
            chunks.append(current_chunk)
            current_chunk = {}
            current_size = 2
        
        current_chunk[str(key)] = value
        current_size += item_size + 1  # +1 for comma
    
    if current_chunk:
        chunks.append(current_chunk)
    
    # Save chunks
    output_dir = input_path.parent
    for i, chunk in enumerate(chunks):
        chunk_file = output_dir / f"{output_prefix}_part{i+1}.json"
        with open(chunk_file, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, ensure_ascii=False, separators=(',', ':'))
        size_mb = chunk_file.stat().st_size / (1024 * 1024)
        print(f"  ✓ {chunk_file.name}: {len(chunk):,} items, {size_mb:.2f}MB")
    
    print(f"✓ Split into {len(chunks)} chunks")
    return len(chunks)

if __name__ == '__main__':
    # Split English reverse index (this is what we'll use for fast lookup)
    split_json_file(
        'padakanaja/english_reverse_index.json',
        'english_reverse_index',
        max_size_mb=20
    )
    
    # Also create a metadata file with chunk count
    metadata = {
        'chunks': len(list(Path('padakanaja').glob('english_reverse_index_part*.json'))),
        'total_words': 103585  # From the merge script output
    }
    with open('padakanaja/english_reverse_index_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"✓ Created metadata file")

