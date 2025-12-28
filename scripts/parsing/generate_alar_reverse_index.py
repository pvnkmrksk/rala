#!/usr/bin/env python3
"""
Generate reverse index for Alar dictionary.
Downloads Alar YAML and generates a pre-built reverse index.
"""

import yaml
import json
import requests
from pathlib import Path
import sys
import re

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.parsing.generate_reverse_index import (
    clean_kannada_entry,
    normalize_type,
    extract_words
)


def download_alar_yaml(url: str = 'https://raw.githubusercontent.com/alar-dict/data/master/alar.yml'):
    """Download Alar dictionary YAML file."""
    print(f"Downloading Alar dictionary from: {url}")
    response = requests.get(url)
    response.raise_for_status()
    return yaml.safe_load(response.text)


def generate_alar_reverse_index(
    alar_url: str = 'https://raw.githubusercontent.com/alar-dict/data/master/alar.yml',
    output_file: str = 'padakanaja/alar_reverse_index.json'
):
    """
    Generate reverse index for Alar dictionary.
    
    Args:
        alar_url: URL to Alar dictionary YAML
        output_file: Path to output JSON file
    """
    print("=" * 80)
    print("Generating Alar Reverse Index")
    print("=" * 80)
    print()
    
    # Download Alar dictionary
    entries = download_alar_yaml(alar_url)
    
    if not entries or not isinstance(entries, list):
        print("Error: Invalid Alar dictionary format")
        return
    
    print(f"Loaded {len(entries):,} entries from Alar dictionary\n")
    
    # Build reverse index
    reverse_index = {}
    all_english_words = set()
    total_entries = 0
    
    for entry in entries:
        if not entry.get('defs'):
            continue
        
        entry_id = entry.get('id', '')
        kannada = clean_kannada_entry(entry.get('entry', ''))
        phone = entry.get('phone', '')
        head = entry.get('head', '')
        dict_title = entry.get('dict_title', "V. Krishna's Alar")
        source = entry.get('source', 'alar')
        
        for def_entry in entry.get('defs', []):
            if not def_entry.get('entry'):
                continue
            
            definition = def_entry.get('entry', '')
            type_str = normalize_type(def_entry.get('type', ''))
            
            # Extract words from definition
            words = extract_words(definition)
            
            # Create index entry
            index_entry = {
                'kannada': kannada,
                'phone': phone,
                'definition': definition,
                'type': type_str,
                'head': head,
                'id': entry_id,
                'dict_title': dict_title,
                'source': source
            }
            
            # Add to reverse index for each word
            for word in words:
                all_english_words.add(word)
                if word not in reverse_index:
                    reverse_index[word] = []
                reverse_index[word].append(index_entry)
                total_entries += 1
    
    print(f"✓ Built reverse index:")
    print(f"  Total words: {len(reverse_index):,}")
    print(f"  Total entries: {total_entries:,}")
    print(f"  Unique English words: {len(all_english_words):,}")
    
    # Save as JSON
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"\nSaving reverse index to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'reverseIndex': reverse_index,
            'allEnglishWords': sorted(list(all_english_words)),
            'version': '1.0',
            'totalWords': len(reverse_index),
            'totalEntries': total_entries,
            'source': 'alar'
        }, f, ensure_ascii=False, indent=2)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"✓ Saved reverse index ({file_size_mb:.2f} MB)")
    
    # Check if we need to split
    if file_size_mb > 70:
        print(f"\n⚠ File is large ({file_size_mb:.2f} MB), splitting into chunks...")
        from scripts.parsing.split_reverse_index import split_reverse_index
        split_reverse_index(str(output_path), 70.0, str(output_path.parent))
        # Rename chunks to alar-specific names
        output_dir = output_path.parent
        for i in range(1, 5):
            old_name = output_dir / f'reverse_index_part{i}.json'
            new_name = output_dir / f'alar_reverse_index_part{i}.json'
            if old_name.exists():
                old_name.rename(new_name)
                print(f"  ✓ Renamed to {new_name.name}")
    
    print(f"\n✓ Alar reverse index ready: {output_path}")


if __name__ == '__main__':
    generate_alar_reverse_index()

