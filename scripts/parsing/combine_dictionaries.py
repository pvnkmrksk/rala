#!/usr/bin/env python3
"""
Combine all dictionary YAML files into a single unified file.
This reduces HTTP requests and improves mobile performance.
"""

import yaml
from pathlib import Path
from typing import List, Dict, Any
import sys

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.parsing.batch_parse_padakanaja import get_dictionary_title


def load_yaml_file(file_path: Path) -> List[Dict[str, Any]]:
    """Load entries from a YAML file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
            if data is None:
                return []
            if isinstance(data, list):
                return data
            return []
    except Exception as e:
        print(f"  ⚠ Warning: Failed to load {file_path.name}: {e}")
        return []


def combine_all_dictionaries(
    padakanaja_dir: str = 'padakanaja',
    alar_url: str = 'https://raw.githubusercontent.com/alar-dict/data/master/alar.yml',
    output_file: str = 'padakanaja/combined_dictionaries.yml',
    split_into_chunks: bool = True,
    chunk_size_mb: float = 70.0
):
    """
    Combine all padakanaja YAML files and optionally fetch Alar dictionary.
    
    Args:
        padakanaja_dir: Directory containing padakanaja YAML files
        alar_url: URL to fetch Alar dictionary (optional, can be None)
        output_file: Path to output combined YAML file
    """
    print("=" * 80)
    print("Combining All Dictionaries")
    print("=" * 80)
    print()
    
    all_entries = []
    padakanaja_path = Path(padakanaja_dir)
    
    # Load all padakanaja YAML files
    yaml_files = sorted(padakanaja_path.glob('*.yml'))
    print(f"Found {len(yaml_files)} padakanaja YAML files\n")
    
    for i, yaml_file in enumerate(yaml_files, 1):
        print(f"[{i}/{len(yaml_files)}] Loading: {yaml_file.name}")
        entries = load_yaml_file(yaml_file)
        
        # Ensure all entries have source info
        for entry in entries:
            if not entry.get('source'):
                entry['source'] = yaml_file.stem
            if not entry.get('dict_title'):
                # Try to get dict_title from mapping
                dict_title = get_dictionary_title(yaml_file.stem, None)
                if dict_title:
                    entry['dict_title'] = dict_title
        
        all_entries.extend(entries)
        print(f"  ✓ Loaded {len(entries)} entries (total: {len(all_entries):,})\n")
    
    print(f"✓ Combined {len(all_entries):,} entries from {len(yaml_files)} padakanaja dictionaries")
    
    # Save combined file (and optionally split into chunks)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    if split_into_chunks:
        # Import split function
        from scripts.parsing.split_combined_dictionary import split_combined_dictionary
        
        # First save the combined file temporarily
        print(f"\nSaving combined dictionary to: {output_path}")
        with open(output_path, 'w', encoding='utf-8') as f:
            yaml.dump(all_entries, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
        file_size = output_path.stat().st_size / (1024 * 1024)  # MB
        print(f"✓ Saved {len(all_entries):,} entries ({file_size:.2f} MB)")
        
        # Now split into chunks
        print(f"\nSplitting into chunks (target: {chunk_size_mb}MB per chunk)...")
        split_combined_dictionary(str(output_path), chunk_size_mb, str(output_path.parent))
        
        # Generate reverse index
        print(f"\nGenerating reverse index...")
        from scripts.parsing.generate_reverse_index import generate_reverse_index
        generate_reverse_index(str(output_path.parent), str(output_path.parent / 'reverse_index.json'))
        
        # Split reverse index into chunks
        print(f"\nSplitting reverse index into chunks...")
        from scripts.parsing.split_reverse_index import split_reverse_index
        split_reverse_index(str(output_path.parent / 'reverse_index.json'), chunk_size_mb, str(output_path.parent))
        
        print(f"\n✓ Combined dictionary ready: {output_path}")
        print(f"  (Also split into chunks for git compatibility)")
        print(f"  (Reverse index generated and split into chunks)")
    else:
        print(f"\nSaving combined dictionary to: {output_path}")
        with open(output_path, 'w', encoding='utf-8') as f:
            yaml.dump(all_entries, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
        file_size = output_path.stat().st_size / (1024 * 1024)  # MB
        print(f"✓ Saved {len(all_entries):,} entries ({file_size:.2f} MB)")
        print(f"\n✓ Combined dictionary ready: {output_path}")


if __name__ == '__main__':
    combine_all_dictionaries()

