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
import re


def clean_text(text):
    """Clean and normalize text fields."""
    if not text:
        return None
    text = text.strip()
    if not text or text == '':
        return None
    return text


def clean_english_word(text):
    """Clean English words: remove quotes, trailing spaces, commas at end, etc."""
    if not text:
        return None
    # Strip whitespace
    text = text.strip()
    if not text:
        return None
    
    # Remove surrounding quotes (single or double) - handle nested quotes
    while (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = text[1:-1].strip()
        if not text:
            return None
    
    # Remove trailing commas (but not commas that are part of the phrase)
    # Only remove if comma is at the very end after whitespace
    text = text.rstrip()
    if text.endswith(','):
        text = text[:-1].rstrip()
    
    # Remove trailing spaces again after comma removal
    text = text.rstrip()
    
    # Remove leading/trailing parentheses if they wrap the entire word
    # But be careful - only if it's a simple wrap, not part of the content
    if len(text) > 2 and text.startswith('(') and text.endswith(')') and text.count('(') == 1 and text.count(')') == 1:
        # Check if there's content before the first ( or after the last )
        inner = text[1:-1].strip()
        if inner:  # Only remove if there's actual content inside
            text = inner
    
    if not text:
        return None
    return text


def clean_kannada_word(text):
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


def contains_kannada_characters(text):
    """
    Check if text contains any Kannada script characters.
    Kannada script range: U+0C80 to U+0CFF
    """
    if not text:
        return False
    # Check for Kannada script characters (U+0C80 to U+0CFF)
    for char in text:
        if '\u0C80' <= char <= '\u0CFF':
            return True
    return False


def is_only_english(text):
    """
    Check if text contains only English characters (and common punctuation/spaces).
    Returns True if text has no Kannada characters.
    """
    if not text:
        return True
    # Remove common punctuation and whitespace to check if only English remains
    cleaned = re.sub(r'[^\w\s\-.,;:!?()\[\]{}"\']', '', text)
    # Check if there are any Kannada characters
    return not contains_kannada_characters(text)


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


def parse_csv_to_yaml(csv_file_path, source_name=None, dict_title=None):
    """
    Parse a CSV file and convert it to YAML format matching the Rala dictionary structure.
    
    Args:
        csv_file_path: Path to the CSV file
        source_name: Name of the source dictionary (for tagging entries, can be filename)
        dict_title: Correct dictionary title (for storing in YAML, fixes typos)
    
    Returns:
        List of dictionary entries in YAML-compatible format
    """
    # If source_name not provided, derive from filename
    if source_name is None:
        source_name = Path(csv_file_path).stem
    
    # Use dict_title if provided, otherwise use source_name
    actual_title = dict_title if dict_title else source_name
    
    print(f"Parsing CSV file: {csv_file_path}")
    print(f"Source dictionary: {source_name}")
    if dict_title:
        print(f"Dictionary title: {dict_title}")
    
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
        entry_index = 0
        
        # Store all entries as flat list (not grouped) - each synonym gets its own entry
        all_entries = []
        
        for row in reader:
            row_count += 1
            
            # Extract fields
            kannada_word_raw = clean_text(row.get(actual_columns.get('kannada_word', ''), ''))
            english_word = clean_english_word(row.get(actual_columns.get('english_word', ''), ''))
            kannada_meaning = clean_text(row.get(actual_columns.get('kannada_meaning', ''), ''))
            english_meaning = clean_english_word(row.get(actual_columns.get('english_meaning', ''), ''))
            pronunciation = clean_text(row.get(actual_columns.get('pronunciation', ''), ''))
            
            # Skip rows without essential data
            if not english_word:
                continue
            
            # Use Kannada word if available, otherwise use Kannada meaning
            # If neither is available, we'll create a placeholder
            if not kannada_word_raw:
                if kannada_meaning:
                    kannada_word_raw = kannada_meaning
                else:
                    # Skip if we have no Kannada representation
                    continue
            
            # Remove numbered prefixes (1. 2. 3. etc.) and split into multiple entries
            # First, split by numbered patterns anywhere in the text (not just at start)
            # Pattern: matches "1." or "2." or "10." etc. with optional space before/after
            # This handles cases like "ಸ್ಪರ್ಶಾಂಗ 2. ಏರಿಯಲ್" -> ["ಸ್ಪರ್ಶಾಂಗ", "ಏರಿಯಲ್"]
            
            # Split by numbered patterns (e.g., " 1. ", " 2. ", "1.", "2.")
            # Use lookahead to split but keep the delimiter context
            parts = re.split(r'\s*\d+\.\s*', kannada_word_raw)
            
            # Also split by semicolon, comma, or slash to handle synonyms
            # Space is NOT a delimiter - only ; , / and numbered patterns are delimiters
            kannada_words = []
            for part in parts:
                # Remove leading numbered prefix if still present (from start of string)
                part = re.sub(r'^\d+\.\s*', '', part)
                
                # Split by semicolon, comma, or slash
                for semicolon_part in part.split(';'):
                    for comma_part in semicolon_part.split(','):
                        for slash_part in comma_part.split('/'):
                            # Strip all whitespace including Unicode spaces (non-breaking spaces, etc.)
                            cleaned = slash_part.strip().strip('\u200B\u200C\u200D\uFEFF\u00A0')
                            # Remove any remaining numbered prefixes
                            cleaned = re.sub(r'^\d+\.\s*', '', cleaned)
                            # Remove trailing numbers with dots (e.g., "word 1." -> "word")
                            cleaned = re.sub(r'\s+\d+\.\s*$', '', cleaned)
                            if cleaned:
                                kannada_words.append(cleaned)
            
            # If no valid words after splitting, use original (with number prefix removed)
            if not kannada_words:
                kannada_words = [kannada_word_raw]
            
            # Determine the English definition to use
            # Prefer English meaning if available, otherwise use English word
            # Clean both before using
            english_definition = clean_english_word(english_meaning) if english_meaning else english_word
            
            # Create definition entry
            def_entry = {
                'entry': english_definition,
                'type': 'Noun'  # Default type, can be customized based on grammar field
            }
            
            # Add grammar type if available
            grammar = clean_text(row.get(actual_columns.get('grammar', ''), ''))
            if grammar:
                # Map common grammar types to full forms
                grammar_map = {
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
                def_entry['type'] = grammar_map.get(grammar.lower(), 'Noun')
            
            # Create a SEPARATE YAML entry for each Kannada synonym
            # This ensures each synonym is searchable independently
            for kannada_word in kannada_words:
                # Skip entries that contain only English words (no Kannada characters)
                if is_only_english(kannada_word):
                    continue
                
                entry_index += 1
                
                # Create YAML entry immediately - no grouping
                yaml_entry = {
                    'entry': clean_kannada_word(kannada_word),  # Clean Kannada entry
                    'defs': [def_entry],  # Single definition per entry
                    'id': generate_entry_id(kannada_word, english_word, entry_index),
                    'source': source_name
                }
                
                # Add dictionary title if provided
                if dict_title:
                    yaml_entry['dict_title'] = dict_title
                
                # Add pronunciation if available
                if pronunciation:
                    yaml_entry['phone'] = pronunciation
                
                # Use English word as head word
                if english_word:
                    yaml_entry['head'] = english_word
                else:
                    yaml_entry['head'] = kannada_word
                
                all_entries.append(yaml_entry)
        
        print(f"Processed {row_count} rows")
        print(f"Created {len(all_entries)} separate entries (synonyms split)")
        
        # Return all entries directly (no grouping)
        return all_entries


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

