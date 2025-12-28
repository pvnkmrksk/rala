#!/usr/bin/env python3
"""
Generate a pre-built reverse index JSON file from dictionary YAML files.
This allows the frontend to load the index directly instead of building it client-side.
"""

import yaml
import json
from pathlib import Path
import sys
import re

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.parsing.batch_parse_padakanaja import get_dictionary_title


def clean_kannada_entry(text):
    """Remove brackets and other non-text characters from Kannada words."""
    if not text:
        return ''
    # Remove brackets: [], (), {}, etc.
    cleaned = text.replace('[', '').replace(']', '').replace('(', '').replace(')', '')
    cleaned = cleaned.replace('{', '').replace('}', '').replace('【', '').replace('】', '')
    cleaned = cleaned.replace('「', '').replace('」', '').replace('〈', '').replace('〉', '')
    cleaned = cleaned.replace('《', '').replace('》', '').replace('『', '').replace('』', '')
    cleaned = cleaned.replace('〔', '').replace('〕', '').replace('［', '').replace('］', '')
    cleaned = cleaned.replace('（', '').replace('）', '').replace('｛', '').replace('｝', '')
    # Remove multiple spaces and trim
    cleaned = ' '.join(cleaned.split())
    return cleaned.strip()


def normalize_type(type_str):
    """Normalize grammar type to full form."""
    if not type_str:
        return 'Noun'
    
    type_lower = type_str.lower().strip()
    type_map = {
        'noun': 'Noun',
        'verb': 'Verb',
        'adjective': 'Adjective',
        'adverb': 'Adverb',
        'pronoun': 'Pronoun',
        'preposition': 'Preposition',
        'conjunction': 'Conjunction',
        'interjection': 'Interjection',
        'n': 'Noun',
        'v': 'Verb',
        'adj': 'Adjective',
        'adv': 'Adverb',
        'pron': 'Pronoun',
        'prep': 'Preposition',
        'conj': 'Conjunction',
        'interj': 'Interjection'
    }
    return type_map.get(type_lower, 'Noun')


def extract_words(text):
    """Extract meaningful words from text (matching JavaScript logic)."""
    if not text:
        return []
    
    # Stop words to skip
    stop_words = {
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
        'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
        'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    }
    
    # Extract words (alphanumeric sequences)
    words = re.findall(r'\b[a-z]+\b', text.lower())
    
    # Filter out stop words and very short words
    meaningful_words = [w for w in words if w not in stop_words and len(w) > 2]
    
    return meaningful_words


def build_reverse_index_from_yaml(yaml_file_path):
    """Build reverse index from a single YAML file."""
    reverse_index = {}
    all_english_words = set()
    
    print(f"Loading: {yaml_file_path.name}")
    with open(yaml_file_path, 'r', encoding='utf-8') as f:
        entries = yaml.safe_load(f)
    
    if not entries or not isinstance(entries, list):
        return reverse_index, all_english_words
    
    for entry in entries:
        if not entry.get('defs'):
            continue
        
        entry_id = entry.get('id', '')
        kannada = clean_kannada_entry(entry.get('entry', ''))
        phone = entry.get('phone', '')
        head = entry.get('head', '')
        dict_title = entry.get('dict_title', '')
        source = entry.get('source', '')
        
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
    
    return reverse_index, all_english_words


def generate_reverse_index(
    padakanaja_dir: str = 'padakanaja',
    output_file: str = 'padakanaja/reverse_index.json'
):
    """
    Generate reverse index from all padakanaja YAML files.
    
    Args:
        padakanaja_dir: Directory containing padakanaja YAML files
        output_file: Path to output JSON file
    """
    print("=" * 80)
    print("Generating Reverse Index")
    print("=" * 80)
    print()
    
    padakanaja_path = Path(padakanaja_dir)
    yaml_files = sorted(padakanaja_path.glob('*.yml'))
    
    # Exclude combined files and reverse index itself
    yaml_files = [f for f in yaml_files if not f.name.startswith('combined_') and not f.name.startswith('reverse_index')]
    
    print(f"Found {len(yaml_files)} padakanaja YAML files\n")
    
    # Build reverse index from all files
    combined_reverse_index = {}
    all_english_words = set()
    total_entries = 0
    
    for i, yaml_file in enumerate(yaml_files, 1):
        print(f"[{i}/{len(yaml_files)}] Processing: {yaml_file.name}")
        file_index, file_words = build_reverse_index_from_yaml(yaml_file)
        
        # Merge into combined index
        for word, entries in file_index.items():
            if word not in combined_reverse_index:
                combined_reverse_index[word] = []
            combined_reverse_index[word].extend(entries)
            total_entries += len(entries)
        
        all_english_words.update(file_words)
        print(f"  ✓ Added {len(file_words)} words, {sum(len(e) for e in file_index.values())} entries")
    
    print(f"\n✓ Built reverse index:")
    print(f"  Total words: {len(combined_reverse_index):,}")
    print(f"  Total entries: {total_entries:,}")
    print(f"  Unique English words: {len(all_english_words):,}")
    
    # Save as JSON
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"\nSaving reverse index to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'reverseIndex': combined_reverse_index,
            'allEnglishWords': sorted(list(all_english_words)),
            'version': '1.0',
            'totalWords': len(combined_reverse_index),
            'totalEntries': total_entries
        }, f, ensure_ascii=False, indent=2)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"✓ Saved reverse index ({file_size_mb:.2f} MB)")
    print(f"\n✓ Reverse index ready: {output_path}")


if __name__ == '__main__':
    generate_reverse_index()

