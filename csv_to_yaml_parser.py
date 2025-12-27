#!/usr/bin/env python3
"""
CSV to YAML Dictionary Parser

Converts CSV dictionary files to YAML format compatible with the Rala dictionary structure.
The output format matches the existing Alar dictionary structure for easy integration.
"""

import csv
import yaml
import sys
import os
import hashlib
from pathlib import Path
from collections import defaultdict
import re


def clean_text(text):
    """Clean and normalize text fields."""
    if not text:
        return None
    text = text.strip()
    if not text or text == '':
        return None
    return text


def generate_entry_id(kannada_word, english_word, index):
    """Generate a unique entry ID."""
    # Create a simple ID based on the words and index
    # Use a hash-based approach for shorter, more reliable IDs
    
    # Create a unique string from the words
    unique_str = f"{kannada_word}|{english_word}|{index}"
    
    # Generate a hash for shorter ID
    hash_obj = hashlib.md5(unique_str.encode('utf-8'))
    hash_hex = hash_obj.hexdigest()[:12]  # Use first 12 chars of hash
    
    # Also include a readable prefix from English word (first 10 chars, cleaned)
    english_clean = re.sub(r'[^\w]', '', english_word.lower())[:10]
    
    # Combine: readable prefix + hash for uniqueness
    entry_id = f"{english_clean}_{hash_hex}"
    
    return entry_id


def parse_csv_to_yaml(csv_file_path, source_name=None):
    """
    Parse a CSV file and convert it to YAML format matching the Rala dictionary structure.
    
    Args:
        csv_file_path: Path to the CSV file
        source_name: Name of the source dictionary (for tagging entries)
    
    Returns:
        List of dictionary entries in YAML-compatible format
    """
    entries = []
    entries_by_kannada = defaultdict(list)
    
    # If source_name not provided, derive from filename
    if source_name is None:
        source_name = Path(csv_file_path).stem
    
    print(f"Parsing CSV file: {csv_file_path}")
    print(f"Source dictionary: {source_name}")
    
    with open(csv_file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        # Map column names to our internal structure
        # Handle different possible column name variations
        column_mapping = {
            'kannada_word': ['ಕನ್ನಡ ಪದ (Kannada Word)', 'ಕನ್ನಡ ಪದ', 'Kannada Word'],
            'english_word': ['ಇಂಗ್ಲೀಷ್ ಪದ (English Word)', 'ಇಂಗ್ಲೀಷ್ ಪದ', 'English Word'],
            'kannada_meaning': ['ಕನ್ನಡ ಅರ್ಥ (Kannada Meaning)', 'ಕನ್ನಡ ಅರ್ಥ', 'Kannada Meaning'],
            'english_meaning': ['ಇಂಗ್ಲೀಷ್ ಅರ್ಥ (English Meaning)', 'ಇಂಗ್ಲೀಷ್ ಅರ್ಥ', 'English Meaning'],
            'pronunciation': ['ಕನ್ನಡ ಉಚ್ಚಾರಣೆ (Kannada Pronunciation)', 'ಕನ್ನಡ ಉಚ್ಚಾರಣೆ', 'Kannada Pronunciation'],
            'synonyms': ['ಪರ್ಯಾಯ ಪದ (Synonyms)', 'ಪರ್ಯಾಯ ಪದ', 'Synonyms'],
            'subject': ['ವಿಷಯ ವರ್ಗೀಕರಣ (Subject)', 'ವಿಷಯ ವರ್ಗೀಕರಣ', 'Subject'],
            'grammar': ['ವ್ಯಾಕರಣ ವಿಶೇಷ (Grammer)', 'ವ್ಯಾಕರಣ ವಿಶೇಷ', 'Grammer'],
            'department': ['ಇಲಾಖೆ (Department)', 'ಇಲಾಖೆ', 'Department'],
            'short_desc': ['ಸಂಕ್ಷಿಪ್ತ ವಿವರಣೆ (Short Description)', 'ಸಂಕ್ಷಿಪ್ತ ವಿವರಣೆ', 'Short Description'],
            'long_desc': ['ದೀರ್ಘ ವಿವರಣೆ (Long Description)', 'ದೀರ್ಘ ವಿವರಣೆ', 'Long Description'],
            'admin_word': ['ಆಡಳಿತಾತ್ಮಕ ಪದ (Administrative Word)', 'ಆಡಳಿತಾತ್ಮಕ ಪದ', 'Administrative Word'],
        }
        
        # Find actual column names in the CSV
        actual_columns = {}
        csv_columns = reader.fieldnames
        for key, possible_names in column_mapping.items():
            for name in possible_names:
                if name in csv_columns:
                    actual_columns[key] = name
                    break
        
        print(f"Found columns: {list(actual_columns.keys())}")
        
        row_count = 0
        for row in reader:
            row_count += 1
            
            # Extract fields
            kannada_word = clean_text(row.get(actual_columns.get('kannada_word', ''), ''))
            english_word = clean_text(row.get(actual_columns.get('english_word', ''), ''))
            kannada_meaning = clean_text(row.get(actual_columns.get('kannada_meaning', ''), ''))
            english_meaning = clean_text(row.get(actual_columns.get('english_meaning', ''), ''))
            pronunciation = clean_text(row.get(actual_columns.get('pronunciation', ''), ''))
            
            # Skip rows without essential data
            if not english_word:
                continue
            
            # Use Kannada word if available, otherwise use Kannada meaning
            # If neither is available, we'll create a placeholder
            if not kannada_word:
                if kannada_meaning:
                    kannada_word = kannada_meaning
                else:
                    # Skip if we have no Kannada representation
                    continue
            
            # Determine the English definition to use
            # Prefer English meaning if available, otherwise use English word
            english_definition = english_meaning if english_meaning else english_word
            
            # Create definition entry
            def_entry = {
                'entry': english_definition,
                'type': 'n'  # Default type, can be customized based on grammar field
            }
            
            # Add grammar type if available
            grammar = clean_text(row.get(actual_columns.get('grammar', ''), ''))
            if grammar:
                # Map common grammar types
                grammar_map = {
                    'noun': 'n',
                    'verb': 'v',
                    'adjective': 'adj',
                    'adverb': 'adv',
                }
                def_entry['type'] = grammar_map.get(grammar.lower(), 'n')
            
            # Store entry data grouped by Kannada word
            entries_by_kannada[kannada_word].append({
                'kannada': kannada_word,
                'pronunciation': pronunciation,
                'definition': def_entry,
                'english_word': english_word,
                'kannada_meaning': kannada_meaning,
                'row_data': row  # Keep full row for additional metadata
            })
        
        print(f"Processed {row_count} rows")
        print(f"Found {len(entries_by_kannada)} unique Kannada words")
    
    # Convert grouped entries to YAML format
    entry_index = 0
    for kannada_word, word_entries in entries_by_kannada.items():
        entry_index += 1
        
        # Get pronunciation from first entry (or None)
        pronunciation = word_entries[0].get('pronunciation')
        
        # Collect all definitions
        defs = []
        for word_entry in word_entries:
            defs.append(word_entry['definition'])
        
        # Create YAML entry matching the expected structure
        yaml_entry = {
            'entry': kannada_word,
            'defs': defs,
            'id': generate_entry_id(kannada_word, word_entries[0]['english_word'], entry_index),
            'source': source_name  # Tag with source for later filtering
        }
        
        # Add pronunciation if available
        if pronunciation:
            yaml_entry['phone'] = pronunciation
        
        # Use first English word as head word (can be customized)
        if word_entries[0]['english_word']:
            yaml_entry['head'] = word_entries[0]['english_word']
        else:
            yaml_entry['head'] = kannada_word
        
        entries.append(yaml_entry)
    
    print(f"Created {len(entries)} YAML entries")
    return entries


def save_yaml(entries, output_path):
    """Save entries to a YAML file."""
    print(f"Saving {len(entries)} entries to {output_path}")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        yaml.dump(
            entries,
            f,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
            width=120
        )
    
    print(f"✓ YAML file saved: {output_path}")


def main():
    """Main function to parse CSV and generate YAML."""
    if len(sys.argv) < 2:
        print("Usage: python csv_to_yaml_parser.py <csv_file> [output_file] [source_name]")
        print("\nExample:")
        print("  python csv_to_yaml_parser.py 'ಕಷ_ವಜಞನ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ.csv'")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    if not os.path.exists(csv_file):
        print(f"Error: CSV file not found: {csv_file}")
        sys.exit(1)
    
    # Determine output file
    if len(sys.argv) >= 3:
        output_file = sys.argv[2]
    else:
        # Generate output filename from input
        base_name = Path(csv_file).stem
        output_file = f"{base_name}.yml"
    
    # Get source name if provided
    source_name = sys.argv[3] if len(sys.argv) >= 4 else None
    
    # Parse CSV to YAML format
    entries = parse_csv_to_yaml(csv_file, source_name)
    
    # Save to YAML file
    save_yaml(entries, output_file)
    
    print(f"\n✓ Conversion complete!")
    print(f"  Input:  {csv_file}")
    print(f"  Output: {output_file}")
    print(f"  Entries: {len(entries)}")


if __name__ == '__main__':
    main()

