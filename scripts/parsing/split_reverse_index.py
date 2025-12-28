#!/usr/bin/env python3
"""
Split the reverse index JSON file into smaller chunks to stay under GitHub's 100MB limit.
"""

import json
from pathlib import Path
import sys

def split_reverse_index(
    input_file: str = 'padakanaja/reverse_index.json',
    chunk_size_mb: float = 70.0,
    output_dir: str = 'padakanaja'
):
    """
    Split a large reverse index JSON file into smaller chunks.
    
    Args:
        input_file: Path to the reverse index JSON file
        chunk_size_mb: Target size per chunk in MB (default 70MB)
        output_dir: Directory to save chunk files
    """
    input_path = Path(input_file)
    output_path = Path(output_dir)
    
    if input_path.exists():
        print(f"Loading reverse index: {input_file}")
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        reverse_index = data.get('reverseIndex', {})
        all_english_words = data.get('allEnglishWords', [])
        
        print(f"Total words: {len(reverse_index):,}")
        print(f"Total entries: {sum(len(entries) for entries in reverse_index.values()):,}")
        
        # Calculate target entries per chunk
        file_size_mb = input_path.stat().st_size / (1024 * 1024)
        print(f"Total file size: {file_size_mb:.2f} MB")
        
        # Split words into chunks
        words_list = list(reverse_index.items())
        total_entries = sum(len(entries) for _, entries in words_list)
        entries_per_mb = total_entries / file_size_mb
        target_entries_per_chunk = int(entries_per_mb * chunk_size_mb)
        
        print(f"Target entries per chunk: {target_entries_per_chunk:,}")
        print()
        
        chunks = []
        current_chunk = {}
        current_chunk_entries = 0
        
        for word, entries in words_list:
            current_chunk[word] = entries
            current_chunk_entries += len(entries)
            
            # Check if we should start a new chunk
            if current_chunk_entries >= target_entries_per_chunk:
                # Check actual size
                temp_chunk_path = output_path / 'temp_chunk.json'
                with open(temp_chunk_path, 'w', encoding='utf-8') as f:
                    json.dump({'reverseIndex': current_chunk}, f, ensure_ascii=False)
                
                temp_size_mb = temp_chunk_path.stat().st_size / (1024 * 1024)
                temp_chunk_path.unlink()
                
                if temp_size_mb >= chunk_size_mb * 0.8:
                    chunks.append(current_chunk)
                    print(f"Chunk {len(chunks)}: {len(current_chunk):,} words, {current_chunk_entries:,} entries (~{temp_size_mb:.2f} MB)")
                    current_chunk = {}
                    current_chunk_entries = 0
        
        # Add remaining as final chunk
        if current_chunk:
            chunks.append(current_chunk)
            temp_chunk_path = output_path / 'temp_chunk.json'
            with open(temp_chunk_path, 'w', encoding='utf-8') as f:
                json.dump({'reverseIndex': current_chunk}, f, ensure_ascii=False)
            temp_size_mb = temp_chunk_path.stat().st_size / (1024 * 1024)
            temp_chunk_path.unlink()
            print(f"Chunk {len(chunks)}: {len(current_chunk):,} words, {current_chunk_entries:,} entries (~{temp_size_mb:.2f} MB)")
        
        print(f"\nSplit into {len(chunks)} chunks")
        print()
        
        # Save chunks
        print("Saving chunks...")
        for i, chunk in enumerate(chunks, 1):
            chunk_filename = f'reverse_index_part{i}.json'
            chunk_path = output_path / chunk_filename
            
            with open(chunk_path, 'w', encoding='utf-8') as f:
                json.dump({
                    'reverseIndex': chunk,
                    'part': i,
                    'totalParts': len(chunks)
                }, f, ensure_ascii=False, indent=2)
            
            chunk_size_mb = chunk_path.stat().st_size / (1024 * 1024)
            print(f"  ✓ {chunk_filename}: {len(chunk):,} words ({chunk_size_mb:.2f} MB)")
        
        # Save metadata file
        metadata = {
            'version': '1.0',
            'totalParts': len(chunks),
            'totalWords': len(reverse_index),
            'allEnglishWords': all_english_words
        }
        metadata_path = output_path / 'reverse_index_metadata.json'
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print(f"  ✓ reverse_index_metadata.json: metadata")
        
        print(f"\n✓ Successfully split into {len(chunks)} chunks")
    else:
        print(f"Error: Input file not found: {input_file}")


if __name__ == '__main__':
    split_reverse_index()

