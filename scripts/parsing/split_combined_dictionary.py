#!/usr/bin/env python3
"""
Split the combined dictionary file into smaller chunks to stay under GitHub's 100MB limit.
Each chunk will be approximately 60-80MB to ensure we're well under the limit.
"""

import yaml
from pathlib import Path
import sys

def split_combined_dictionary(
    input_file: str = 'padakanaja/combined_dictionaries.yml',
    chunk_size_mb: float = 70.0,
    output_dir: str = 'padakanaja'
):
    """
    Split a large YAML dictionary file into smaller chunks.
    
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
        all_entries = yaml.safe_load(f)
    
    if not all_entries or not isinstance(all_entries, list):
        print("Error: Invalid YAML file or empty entries")
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
    current_chunk_size = 0
    
    for i, entry in enumerate(all_entries):
        current_chunk.append(entry)
        current_chunk_size += 1
        
        # Check if we should start a new chunk
        # We'll check actual file size after writing a few entries
        if len(current_chunk) >= target_entries_per_chunk:
            # Write a temporary chunk to check size
            temp_chunk_path = output_path / 'temp_chunk.yml'
            with open(temp_chunk_path, 'w', encoding='utf-8') as f:
                yaml.dump(current_chunk, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
            
            temp_size_mb = temp_chunk_path.stat().st_size / (1024 * 1024)
            temp_chunk_path.unlink()  # Delete temp file
            
            # If we're close to the limit, save this chunk
            if temp_size_mb >= chunk_size_mb * 0.8:  # Start new chunk at 80% of target
                chunks.append(current_chunk)
                print(f"Chunk {len(chunks)}: {len(current_chunk):,} entries (~{temp_size_mb:.2f} MB)")
                current_chunk = []
                current_chunk_size = 0
    
    # Add remaining entries as final chunk
    if current_chunk:
        chunks.append(current_chunk)
        # Calculate size for last chunk
        temp_chunk_path = output_path / 'temp_chunk.yml'
        with open(temp_chunk_path, 'w', encoding='utf-8') as f:
            yaml.dump(current_chunk, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        temp_size_mb = temp_chunk_path.stat().st_size / (1024 * 1024)
        temp_chunk_path.unlink()
        print(f"Chunk {len(chunks)}: {len(current_chunk):,} entries (~{temp_size_mb:.2f} MB)")
    
    print(f"\nSplit into {len(chunks)} chunks")
    print()
    
    # Save chunks
    print("Saving chunks...")
    for i, chunk in enumerate(chunks, 1):
        chunk_filename = f'combined_dictionaries_part{i}.yml'
        chunk_path = output_path / chunk_filename
        
        with open(chunk_path, 'w', encoding='utf-8') as f:
            yaml.dump(chunk, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
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
    split_combined_dictionary()

