#!/usr/bin/env python3
"""
Generate a pre-filtered list of English words for the glossary page.
This is much faster than generating it on-the-fly in the browser.
"""

import yaml
import json
import re
from pathlib import Path

def extract_words(text):
    """Extract meaningful English words from text."""
    if not text:
        return []
    
    # Extract words (lowercase, alphanumeric)
    words = re.findall(r'\b[a-z]+\b', text.lower())
    return words

def is_junk_word(word):
    """Check if a word should be filtered out (same logic as glossary.html)."""
    w = word.strip()
    
    # Skip empty
    if not w or len(w) == 0:
        return True
    
    # Skip entries shorter than 2 characters
    if len(w) < 2:
        return True
    
    # Skip entries that are just numbers
    if re.match(r'^\d+$', w):
        return True
    
    # Skip entries that start with numbers
    if re.match(r'^\d', w):
        return True
    
    # Skip entries that are mostly numbers with dashes
    if re.match(r'^\d+-\d+', w):
        return True
    
    # Skip ordinals
    if re.match(r'^\d+(st|nd|rd|th)$', w, re.IGNORECASE):
        return True
    
    # Skip entries that start or end with hyphens
    if re.match(r'^-|-$', w):
        return True
    
    # Skip entries with multiple consecutive hyphens
    if '--' in w:
        return True
    
    # Skip entries with underscores
    if '_' in w:
        return True
    
    # Skip entries that contain numbers
    if re.search(r'\d', w):
        return True
    
    # Skip entries that don't start with a letter
    if not re.match(r'^[a-z]', w, re.IGNORECASE):
        return True
    
    # Skip entries that are just punctuation or symbols
    if not re.search(r'[a-z]', w, re.IGNORECASE):
        return True
    
    # Skip entries that are mostly special characters (at least 50% must be letters)
    letter_count = len(re.findall(r'[a-z]', w, re.IGNORECASE))
    if letter_count < len(w) * 0.5:
        return True
    
    return False

def generate_glossary_words(yaml_url=None, yaml_file=None, output_file='glossary_words.json'):
    """Generate filtered word list from Alar YAML."""
    
    # Load YAML
    if yaml_file:
        print(f"Loading YAML from file: {yaml_file}")
        with open(yaml_file, 'r', encoding='utf-8') as f:
            entries = yaml.safe_load(f)
    elif yaml_url:
        import urllib.request
        print(f"Loading YAML from URL: {yaml_url}")
        with urllib.request.urlopen(yaml_url) as response:
            entries = yaml.safe_load(response.read().decode('utf-8'))
    else:
        raise ValueError("Either yaml_url or yaml_file must be provided")
    
    if not entries or not isinstance(entries, list):
        raise ValueError("Invalid YAML format")
    
    print(f"Loaded {len(entries)} entries")
    
    # Extract all English words
    all_words = set()
    
    for entry in entries:
        if not entry.get('defs'):
            continue
        
        for def_entry in entry.get('defs', []):
            if not def_entry.get('entry'):
                continue
            
            definition = def_entry.get('entry', '')
            words = extract_words(definition)
            
            for word in words:
                if not is_junk_word(word):
                    all_words.add(word)
    
    # Convert to sorted list
    word_list = sorted(list(all_words))
    
    print(f"Extracted {len(word_list)} unique English words")
    
    # Save to JSON
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(word_list, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Saved to {output_path}")
    print(f"  File size: {output_path.stat().st_size / 1024:.1f} KB")
    
    return word_list

if __name__ == '__main__':
    import sys
    
    # Default: use GitHub URL
    yaml_url = 'https://raw.githubusercontent.com/alar-dict/data/master/alar.yml'
    output_file = 'glossary_words.json'
    
    if len(sys.argv) > 1:
        # If argument provided, treat as local file
        yaml_file = sys.argv[1]
        yaml_url = None
    else:
        yaml_file = None
    
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    try:
        words = generate_glossary_words(yaml_url=yaml_url, yaml_file=yaml_file, output_file=output_file)
        print(f"\n✅ Success! Generated {len(words)} words")
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        sys.exit(1)

