#!/usr/bin/env python3
"""
Create reverse index for Padakanaja dictionary only
Maps English words -> List of Kannada entries
Optimized for Cloudflare KV (split into chunks < 25MB)
Includes entry IDs for audio support - FIXED to use same IDs as audio generation
"""

import json
import os
import sys
import hashlib
import re
from pathlib import Path
from collections import defaultdict

def load_audio_index_mapping():
    """Load audio_index.json and word_id_mapping.json to enable (kannada, english) -> entry_id lookup"""
    audio_index_path = Path('/Users/pavan/src/padakanaja-voice-corpus/audio_index.json')
    word_mapping_path = Path('/Users/pavan/src/padakanaja-voice-corpus/word_id_mapping.json')
    
    if not audio_index_path.exists():
        print(f"⚠ Warning: {audio_index_path} not found, will generate IDs on the fly")
        return None, None
    
    if not word_mapping_path.exists():
        print(f"⚠ Warning: {word_mapping_path} not found, will generate IDs on the fly")
        return None, None
    
    print("📚 Loading audio index and word mapping...")
    
    # Load audio_index.json (entry_id -> sequential_id)
    with open(audio_index_path, 'r', encoding='utf-8') as f:
        audio_index = json.load(f)
    
    # Load word_id_mapping.json to get kannada -> {primary_id, all_ids} mapping
    with open(word_mapping_path, 'r', encoding='utf-8') as f:
        word_mapping = json.load(f)
    
    word_id_map = word_mapping.get('word_id_map', {})
    
    print(f"✓ Loaded audio index: {len(audio_index):,} entry IDs")
    print(f"✓ Loaded word mapping: {len(word_id_map):,} Kannada words")
    return audio_index, word_id_map

def generate_entry_id(kannada_word, english_word, index=0):
    """Generate entry ID matching the format used in voice corpus"""
    unique_str = f"{kannada_word}|{english_word}|{index}"
    hash_obj = hashlib.md5(unique_str.encode('utf-8'))
    hash_hex = hash_obj.hexdigest()[:12]
    english_clean = re.sub(r'[^\w]', '', english_word.lower())[:10]
    entry_id = f"{english_clean}_{hash_hex}"
    return entry_id

def find_entry_id_for_pair(kannada, english, word_id_map, audio_index):
    """Find the correct entry_id for a (kannada, english) pair"""
    if not kannada or not english:
        return ''
    
    # Get all valid IDs for this kannada word (if available)
    valid_kannada_ids = []
    if kannada in word_id_map:
        data = word_id_map[kannada]
        all_ids = data.get('all_ids', [])
        # Filter to only IDs that exist in audio_index
        valid_kannada_ids = [eid for eid in all_ids if eid in audio_index]
    
    # First, try to regenerate the ID using the same algorithm
    # Try index 0, 1, 2, ... up to 20 (should cover most cases)
    # Prefer IDs that are also in the valid_kannada_ids list
    matched_ids = []
    for index in range(20):
        generated_id = generate_entry_id(kannada, english, index)
        if generated_id in audio_index:
            if valid_kannada_ids and generated_id in valid_kannada_ids:
                # This is a perfect match - return immediately
                return generated_id
            matched_ids.append(generated_id)
    
    # If we found matches, prefer one that's in valid_kannada_ids
    if matched_ids:
        for mid in matched_ids:
            if valid_kannada_ids and mid in valid_kannada_ids:
                return mid
        # Otherwise, return the first match
        return matched_ids[0]
    
    # Fallback: if regeneration doesn't work, try looking up by kannada word
    # This is less precise but might catch some cases
    if valid_kannada_ids:
        # Prefer primary_id if it's valid
        if kannada in word_id_map:
            primary_id = word_id_map[kannada].get('primary_id', '')
            if primary_id and primary_id in valid_kannada_ids:
                return primary_id
        # Otherwise, use the first valid ID
        return valid_kannada_ids[0]
    
    return ''

def load_padakanaja(audio_index, word_id_map):
    """Load Padakanaja dictionary from optimized format and match IDs from audio index"""
    # Try multiple possible paths
    script_dir = Path(__file__).parent
    possible_paths = [
        script_dir / 'padakanaja' / 'combined_dictionaries_ultra.json',
        script_dir.parent.parent / 'padakanaja' / 'combined_dictionaries_ultra.json',
        Path('padakanaja/combined_dictionaries_ultra.json'),
    ]
    
    input_file = None
    for path in possible_paths:
        if path.exists():
            input_file = path
            break
    
    if input_file is None:
        print(f"❌ Error: combined_dictionaries_ultra.json not found in any of these locations:")
        for path in possible_paths:
            print(f"   - {path}")
        sys.exit(1)
    
    print(f"📚 Loading Padakanaja dictionary from {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    entries = []
    matched_ids = 0
    unmatched_entries = []
    
    if audio_index is None or word_id_map is None:
        print("⚠ No audio index or word mapping available, skipping ID matching")
        # Still load entries but without IDs
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
                            
                            entries.append({
                                'kannada': kannada,
                                'english': english,
                                'type': type_val,
                                'source': source,
                                'dict_title': dict_title,
                                'id': ''
                            })
        print(f"✓ Loaded {len(entries):,} Padakanaja entries (no IDs)")
        return entries
    
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
                        
                        # Find entry_id for this (kannada, english) pair
                        entry_id = find_entry_id_for_pair(kannada, english, word_id_map, audio_index)
                        if entry_id:
                            matched_ids += 1
                            entries.append({
                                'kannada': kannada,
                                'english': english,
                                'type': type_val,
                                'source': source,
                                'dict_title': dict_title,
                                'id': entry_id
                            })
                        else:
                            # Store for later - we'll skip entries without audio
                            unmatched_entries.append((kannada, english, type_val, source, dict_title))
    
    print(f"✓ Loaded {len(entries):,} Padakanaja entries with matched IDs")
    print(f"  Matched: {matched_ids:,}, Unmatched: {len(unmatched_entries):,}")
    
    # For unmatched entries, we could generate IDs, but they won't have audio
    # For now, we'll skip them to ensure consistency
    if unmatched_entries:
        print(f"⚠ Skipping {len(unmatched_entries):,} unmatched entries (no audio available)")
    
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
    # Load audio index and word mapping
    audio_index, word_id_map = load_audio_index_mapping()
    
    # Load Padakanaja with correct IDs
    entries = load_padakanaja(audio_index, word_id_map)
    
    # Build reverse index
    reverse_index = build_reverse_index(entries)
    
    # Split into chunks
    chunks = split_into_chunks(reverse_index, max_size_mb=20)
    
    # Save chunks
    print("💾 Saving chunks...")
    # Ensure output directory exists
    script_dir = Path(__file__).parent
    output_dir = script_dir.parent.parent / 'padakanaja'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for i, chunk in enumerate(chunks, 1):
        output_file = output_dir / f'padakanaja_reverse_index_part{i}.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(chunk, f, ensure_ascii=False, indent=0)
        chunk_size_mb = os.path.getsize(output_file) / 1024 / 1024
        print(f"  ✓ Saved {output_file} ({chunk_size_mb:.2f} MB)")
    
    # Create and save chunk index
    chunk_index = create_chunk_index(chunks)
    index_file = output_dir / 'padakanaja_reverse_index_chunk_index.json'
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(chunk_index, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {index_file}")
    
    # Save metadata
    metadata = {
        'total_words': len(reverse_index),
        'total_chunks': len(chunks),
        'chunk_sizes': [len(chunk) for chunk in chunks]
    }
    metadata_file = output_dir / 'padakanaja_reverse_index_metadata.json'
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {metadata_file}")
    
    print(f"\n✅ Reverse index created successfully!")
    print(f"   Total words: {len(reverse_index):,}")
    print(f"   Total chunks: {len(chunks)}")
    print(f"   Ready for Cloudflare KV upload")

if __name__ == '__main__':
    main()

