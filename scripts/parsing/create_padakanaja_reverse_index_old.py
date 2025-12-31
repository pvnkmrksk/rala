#!/usr/bin/env python3
"""
Create reverse index for Padakanaja dictionary only
Maps English words -> List of Kannada entries
Optimized for Cloudflare KV (split into chunks < 25MB)
Includes entry IDs for audio support
"""

import json
import os
import sys
import hashlib
import re
from collections import defaultdict

def generate_entry_id(kannada_word, english_word, index=0):
    """Generate entry ID matching the format used in voice corpus"""
    unique_str = f"{kannada_word}|{english_word}|{index}"
    hash_obj = hashlib.md5(unique_str.encode('utf-8'))
    hash_hex = hash_obj.hexdigest()[:12]
    english_clean = re.sub(r'[^\w]', '', english_word.lower())[:10]
    entry_id = f"{english_clean}_{hash_hex}"
    return entry_id

def load_padakanaja():
    """Load Padakanaja dictionary from optimized format and generate IDs"""
    input_file = 'padakanaja/combined_dictionaries_ultra.json'
    
    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        sys.exit(1)
    
    print(f"📚 Loading Padakanaja dictionary from {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    entries = []
    entry_index = 0
    if isinstance(data, dict):
        for key, entries_list in data.items():
            source = key.split('|')[0] if '|' in key else key
            dict_title = key.split('|')[1] if '|' in key else ''
            
            if isinstance(entries_list, list):
                for entry_data in entries_list:
                    if isinstance(entry_data, list) and len(entry_data) >= 2:
                        kannada = entry_data[0]
                        english = entry_data[1]
                        type_val = entry_data[2] if len(entry_data) > 2 else 'Noun'
                        
                        # Generate entry ID (same format as voice corpus)
                        entry_id = generate_entry_id(kannada, english, entry_index)
                        entry_index += 1
                        
                        entries.append({
                            'kannada': kannada,
                            'english': english,
                            'type': type_val,
                            'source': source,
                            'dict_title': dict_title,
                            'id': entry_id
                        })
    
    print(f"✓ Loaded {len(entries):,} Padakanaja entries with IDs")
    return entries

def build_reverse_index(entries):
    """Build English -> Kannada reverse index"""
    print("🔨 Building reverse index...")
    reverse_index = defaultdict(list)
    
    for entry in entries:
        english = entry['english']
        if not english:
            continue
        
        # Split English into words and index each word
        words = english.lower().split()
        for word in words:
            # Clean word (remove punctuation)
            clean_word = ''.join(c for c in word if c.isalnum())
            if len(clean_word) >= 2:  # Only index words with 2+ characters
                reverse_index[clean_word].append({
                    'kannada': entry['kannada'],
                    'english': entry['english'],
                    'type': entry['type'],
                    'source': entry['source'],
                    'dict_title': entry['dict_title'],
                    'id': entry.get('id', '')  # Include entry ID for audio support
                })
    
    # Remove duplicates (same kannada-english pair)
    for word in reverse_index:
        seen = set()
        unique_entries = []
        for entry in reverse_index[word]:
            key = (entry['kannada'], entry['english'])
            if key not in seen:
                seen.add(key)
                unique_entries.append(entry)
        reverse_index[word] = unique_entries
    
    print(f"✓ Built reverse index: {len(reverse_index):,} unique English words")
    return dict(reverse_index)

def split_into_chunks(reverse_index, max_size_mb=20):
    """Split reverse index into chunks < max_size_mb"""
    print(f"📦 Splitting reverse index into chunks < {max_size_mb}MB...")
    
    max_size_bytes = max_size_mb * 1024 * 1024
    chunks = []
    current_chunk = {}
    current_size = 0
    
    # Sort words for consistent chunking
    sorted_words = sorted(reverse_index.items())
    
    for word, entries in sorted_words:
        # Estimate size of this word's data
        word_data = {word: entries}
        word_json = json.dumps(word_data)
        word_size = len(word_json.encode('utf-8'))
        
        # If adding this word would exceed limit, save current chunk
        if current_size + word_size > max_size_bytes and current_chunk:
            chunks.append(current_chunk)
            current_chunk = {}
            current_size = 0
        
        current_chunk[word] = entries
        current_size += word_size
    
    # Add final chunk
    if current_chunk:
        chunks.append(current_chunk)
    
    print(f"✓ Split into {len(chunks)} chunks")
    
    # Verify chunk sizes
    for i, chunk in enumerate(chunks, 1):
        chunk_json = json.dumps(chunk)
        chunk_size_mb = len(chunk_json.encode('utf-8')) / 1024 / 1024
        print(f"  Chunk {i}: {chunk_size_mb:.2f} MB ({len(chunk):,} words)")
    
    return chunks

def create_chunk_index(chunks):
    """Create small index mapping word prefixes to chunk numbers"""
    print("📇 Creating chunk index...")
    
    chunk_index = {}
    for chunk_num, chunk in enumerate(chunks, 1):  # Start from 1, not 0
        for word in chunk.keys():
            # Use first 3 characters as prefix
            prefix = word[:3].lower()
            if prefix not in chunk_index:
                chunk_index[prefix] = []
            if chunk_num not in chunk_index[prefix]:
                chunk_index[prefix].append(chunk_num)
            
            # Also index first character for fallback
            first_char = word[0].lower() if word else ''
            if first_char and first_char not in chunk_index:
                chunk_index[first_char] = []
            if first_char and chunk_num not in chunk_index[first_char]:
                chunk_index[first_char].append(chunk_num)
    
    print(f"✓ Created chunk index: {len(chunk_index):,} prefixes")
    return chunk_index

def main():
    # Load Padakanaja
    entries = load_padakanaja()
    
    # Build reverse index
    reverse_index = build_reverse_index(entries)
    
    # Split into chunks
    chunks = split_into_chunks(reverse_index, max_size_mb=20)
    
    # Save chunks
    print("💾 Saving chunks...")
    for i, chunk in enumerate(chunks, 1):
        output_file = f'padakanaja/padakanaja_reverse_index_part{i}.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, ensure_ascii=False, indent=0)
        chunk_size_mb = os.path.getsize(output_file) / 1024 / 1024
        print(f"  ✓ Saved {output_file} ({chunk_size_mb:.2f} MB)")
    
    # Create and save chunk index
    chunk_index = create_chunk_index(chunks)
    index_file = 'padakanaja/padakanaja_reverse_index_chunk_index.json'
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(chunk_index, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {index_file}")
    
    # Save metadata
    metadata = {
        'total_words': len(reverse_index),
        'total_chunks': len(chunks),
        'chunk_sizes': [len(chunk) for chunk in chunks]
    }
    metadata_file = 'padakanaja/padakanaja_reverse_index_metadata.json'
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {metadata_file}")
    
    print(f"\n✅ Reverse index created successfully!")
    print(f"   Total words: {len(reverse_index):,}")
    print(f"   Total chunks: {len(chunks)}")
    print(f"   Ready for Cloudflare KV upload")

if __name__ == '__main__':
    main()

