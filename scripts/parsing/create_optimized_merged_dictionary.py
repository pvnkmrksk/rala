#!/usr/bin/env python3
"""
Create optimized merged dictionary for Cloudflare Worker:
1. Combines Alar + Padakanaja
2. Reverse merges by Kannada word (each Kannada word appears once)
3. All English definitions are merged and numbered
4. Optimized for fast server-side lookup
"""

import json
import yaml
from pathlib import Path
from collections import defaultdict
from urllib.request import urlopen
import re

def clean_kannada_entry(text):
    """Clean Kannada entry (remove brackets, numbers, etc.)"""
    if not text:
        return ''
    # Remove content in brackets, parentheses, numbers
    text = re.sub(r'[\(\[].*?[\)\]]', '', text)
    text = re.sub(r'\d+', '', text)
    return text.strip()

def load_alar(alar_url='https://raw.githubusercontent.com/alar-dict/data/master/alar.yml'):
    """Load Alar dictionary from URL"""
    print(f"Loading Alar dictionary from: {alar_url}")
    try:
        with urlopen(alar_url) as response:
            data = yaml.safe_load(response)
        print(f"✓ Loaded {len(data)} Alar entries")
        return data
    except Exception as e:
        print(f"⚠ Error loading Alar: {e}")
        import traceback
        traceback.print_exc()
        return []

def load_padakanaja_combined():
    """Load combined Padakanaja dictionary"""
    padakanaja_file = Path('padakanaja/combined_dictionaries_ultra.json')
    if not padakanaja_file.exists():
        print(f"⚠ Error: {padakanaja_file} not found")
        return {}
    
    print(f"Loading Padakanaja dictionary from: {padakanaja_file}")
    with open(padakanaja_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Expand optimized format
    entries = []
    if isinstance(data, dict):
        for key, entries_list in data.items():
            # Key format: "source|dict_title" or just "source"
            source, dict_title = key.split('|', 1) if '|' in key else (key, '')
            
            # entries_list is a list of [kannada, english, type?] arrays
            if isinstance(entries_list, list):
                for entry_data in entries_list:
                    if isinstance(entry_data, list) and len(entry_data) >= 2:
                        kannada = entry_data[0]
                        english = entry_data[1]
                        type_str = entry_data[2] if len(entry_data) > 2 else 'Noun'
                        entries.append({
                            'kannada': kannada,
                            'english': english,
                            'type': type_str,
                            'source': source,
                            'dict_title': dict_title
                        })
    
    print(f"✓ Loaded {len(entries)} Padakanaja entries")
    return entries

def create_merged_dictionary():
    """Create optimized merged dictionary"""
    print("=" * 80)
    print("Creating Optimized Merged Dictionary")
    print("=" * 80)
    print()
    
    # Load both dictionaries
    alar_entries = load_alar()
    padakanaja_entries = load_padakanaja_combined()
    
    # Build reverse index: Kannada -> List of English definitions
    kannada_index = defaultdict(lambda: {
        'definitions': [],  # List of {english, type, source, dict_title}
        'sources': set()    # Track unique sources
    })
    
    print("\nProcessing Alar entries...")
    for entry in alar_entries:
        kannada = clean_kannada_entry(entry.get('entry', ''))
        if not kannada:
            continue
        
        for def_entry in entry.get('defs', []):
            english = def_entry.get('entry', '').strip()
            if not english:
                continue
            
            type_str = def_entry.get('type', 'Noun')
            kannada_index[kannada]['definitions'].append({
                'english': english,
                'type': type_str,
                'source': entry.get('source', 'alar'),
                'dict_title': entry.get('dict_title', "V. Krishna's Alar")
            })
            kannada_index[kannada]['sources'].add(entry.get('source', 'alar'))
    
    print(f"✓ Processed {len(alar_entries)} Alar entries")
    
    print("\nProcessing Padakanaja entries...")
    padakanaja_count = 0
    for entry in padakanaja_entries:
        kannada = clean_kannada_entry(entry.get('kannada', ''))
        if not kannada:
            continue
        
        english = entry.get('english', '').strip()
        if not english:
            continue
        
        kannada_index[kannada]['definitions'].append({
            'english': english,
            'type': entry.get('type', 'Noun'),
            'source': entry.get('source', 'padakanaja'),
            'dict_title': entry.get('dict_title', '')
        })
        kannada_index[kannada]['sources'].add(entry.get('source', 'padakanaja'))
        padakanaja_count += 1
    
    print(f"✓ Processed {padakanaja_count} Padakanaja entries")
    
    # Convert to optimized format
    print("\nCreating optimized format...")
    optimized = {}
    total_definitions = 0
    
    for kannada, data in kannada_index.items():
        # Sort definitions by priority (Alar first, then by type)
        definitions = sorted(data['definitions'], key=lambda d: (
            0 if d['source'] == 'alar' else 1,  # Alar first
            d['type']  # Then by type
        ))
        
        # Format definitions as numbered list
        formatted_defs = []
        for i, def_item in enumerate(definitions, 1):
            formatted_defs.append(f"{i}) {def_item['english']}")
        
        optimized[kannada] = {
            'definitions': formatted_defs,  # Numbered list
            'all_definitions': definitions,  # Full data for search
            'sources': sorted(list(data['sources'])),
            'count': len(definitions)
        }
        total_definitions += len(definitions)
    
    print(f"✓ Created {len(optimized):,} unique Kannada words")
    print(f"✓ Total definitions: {total_definitions:,}")
    
    # Save optimized dictionary
    output_file = Path('padakanaja/merged_dictionary_optimized.json')
    print(f"\nSaving to: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(optimized, f, ensure_ascii=False, separators=(',', ':'))
    
    file_size_mb = output_file.stat().st_size / (1024 * 1024)
    print(f"✓ Saved ({file_size_mb:.2f} MB)")
    
    # Also create English->Kannada reverse index for fast search
    print("\nCreating English->Kannada reverse index...")
    english_index = defaultdict(list)
    
    for kannada, data in optimized.items():
        for def_item in data['all_definitions']:
            english_lower = def_item['english'].lower()
            # Extract individual words
            words = english_lower.split()
            for word in words:
                # Remove punctuation
                word = ''.join(c for c in word if c.isalnum())
                if len(word) > 2:  # Skip very short words
                    english_index[word].append({
                        'kannada': kannada,
                        'full_definition': def_item['english'],
                        'type': def_item['type'],
                        'source': def_item['source']
                    })
    
    # Deduplicate
    for word in english_index:
        seen = set()
        unique_entries = []
        for entry in english_index[word]:
            key = (entry['kannada'], entry['full_definition'])
            if key not in seen:
                seen.add(key)
                unique_entries.append(entry)
        english_index[word] = unique_entries
    
    reverse_index_file = Path('padakanaja/english_reverse_index.json')
    print(f"Saving English reverse index to: {reverse_index_file}")
    with open(reverse_index_file, 'w', encoding='utf-8') as f:
        json.dump(dict(english_index), f, ensure_ascii=False, separators=(',', ':'))
    
    reverse_size_mb = reverse_index_file.stat().st_size / (1024 * 1024)
    print(f"✓ Saved ({reverse_size_mb:.2f} MB)")
    print(f"✓ Indexed {len(english_index):,} unique English words")
    
    print("\n" + "=" * 80)
    print("✓ Optimization complete!")
    print(f"  - {len(optimized):,} unique Kannada words")
    print(f"  - {total_definitions:,} total definitions")
    print(f"  - {len(english_index):,} unique English words indexed")
    print(f"  - Ready for Cloudflare Worker upload")
    print("=" * 80)

if __name__ == '__main__':
    create_merged_dictionary()

