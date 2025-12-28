#!/usr/bin/env python3
"""
Split the combined dictionary JSON file into smaller chunks to stay under GitHub's 100MB limit.
JSON is more compact and faster to parse than YAML.
"""

import json
from pathlib import Path
import sys

def split_combined_dictionary_json(
    input_file: str = 'padakanaja/combined_dictionaries.json',
    chunk_size_mb: float = 70.0,
    output_dir: str = 'padakanaja'
):
    """
    Split a large JSON dictionary file into smaller chunks.
    
    Args:
        input_file: Path to the combined dictionary file
        chunk_size_mb: Target size per chunk in MB (default 70MB to stay well under 100MB)
        output_dir: Directory to save chunk files
    """
    input_path = Path(input_file)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_file}")
        return
    
    print(f"Loading combined dictionary: {input_file}")
    with open(input_path, 'r', encoding='utf-8') as f:
        all_entries = json.load(f)
    
    if not all_entries or not isinstance(all_entries, list):
        print("Error: Invalid JSON file or empty entries")
        return
    
    total_entries = len(all_entries)
    print(f"Total entries: {total_entries:,}")
    
    # Calculate target entries per chunk based on file size
    file_size_mb = input_path.stat().st_size / (1024 * 1024)
    print(f"Total file size: {file_size_mb:.2f} MB")
    
    # Estimate entries per MB (rough estimate)
    entries_per_mb = total_entries / file_size_mb
    target_entries_per_chunk = int(entries_per_mb * chunk_size_mb)
    
    print(f"Target entries per chunk: {target_entries_per_chunk:,}")
    print()
    
    # Split into chunks
    chunks = []
    current_chunk = []
    
    for i, entry in enumerate(all_entries):
        current_chunk.append(entry)
        
        # Check if we should start a new chunk
        if len(current_chunk) >= target_entries_per_chunk:
            # Write a temporary chunk to check size
            temp_chunk_path = output_path / 'temp_chunk.json'
            with open(temp_chunk_path, 'w', encoding='utf-8') as f:
                json.dump(current_chunk, f, ensure_ascii=False, indent=2)
            
            temp_size_mb = temp_chunk_path.stat().st_size / (1024 * 1024)
            temp_chunk_path.unlink()  # Delete temp file
            
            # If we're close to the limit, save this chunk
            if temp_size_mb >= chunk_size_mb * 0.8:  # Start new chunk at 80% of target
                chunks.append(current_chunk)
                print(f"Chunk {len(chunks)}: {len(current_chunk):,} entries (~{temp_size_mb:.2f} MB)")
                current_chunk = []
    
    # Add remaining entries as final chunk
    if current_chunk:
        chunks.append(current_chunk)
        # Calculate size for last chunk
        temp_chunk_path = output_path / 'temp_chunk.json'
        with open(temp_chunk_path, 'w', encoding='utf-8') as f:
            json.dump(current_chunk, f, ensure_ascii=False, indent=2)
        temp_size_mb = temp_chunk_path.stat().st_size / (1024 * 1024)
        temp_chunk_path.unlink()
        print(f"Chunk {len(chunks)}: {len(current_chunk):,} entries (~{temp_size_mb:.2f} MB)")
    
    print(f"\nSplit into {len(chunks)} chunks")
    print()
    
    # Save chunks as JSON
    print("Saving chunks...")
    for i, chunk in enumerate(chunks, 1):
        chunk_filename = f'combined_dictionaries_part{i}.json'
        chunk_path = output_path / chunk_filename
        
        with open(chunk_path, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, ensure_ascii=False, indent=2)
        
        chunk_size_mb = chunk_path.stat().st_size / (1024 * 1024)
        print(f"  ✓ {chunk_filename}: {len(chunk):,} entries ({chunk_size_mb:.2f} MB)")
    
    print(f"\n✓ Successfully split into {len(chunks)} chunks")
    print(f"  Total entries: {sum(len(c) for c in chunks):,}")
    
    # Verify all entries are accounted for
    total_chunk_entries = sum(len(c) for c in chunks)
    if total_chunk_entries != total_entries:
        print(f"⚠ Warning: Entry count mismatch! Original: {total_entries}, Chunks: {total_chunk_entries}")
    else:
        print("✓ All entries accounted for")


if __name__ == '__main__':
    split_combined_dictionary_json()

