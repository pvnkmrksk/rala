#!/usr/bin/env python3
"""
Rename dictionary files to use canonical names (fixing typos).
This script renames CSV, JSON, and YAML files based on the title mapping.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.parsing.batch_parse_padakanaja import get_dictionary_title_mapping, get_dictionary_title


def get_canonical_filename(dict_name):
    """
    Get canonical filename from dictionary name.
    Uses the title mapping to get the correct name, then converts to filename.
    """
    # First, try to find the canonical title from the mapping
    title_map = get_dictionary_title_mapping()
    
    # Try to find a match - check if any filename stem matches
    # We need to reverse lookup: find the canonical title for this dict_name
    # The dict_name from website might have typos, so we need to match it
    
    # Create a temporary filename from dict_name to check against mapping
    temp_filename = dict_name.replace('|', '_').replace('/', '_').strip()
    
    # Check if this temp filename matches any key in title_map
    if temp_filename in title_map:
        canonical_title = title_map[temp_filename]
    else:
        # Try to find by partial match or use get_dictionary_title
        canonical_title = get_dictionary_title(temp_filename, None)
        if not canonical_title:
            # If no mapping found, use the dict_name as-is (but sanitized)
            canonical_title = dict_name
    
    # Convert canonical title to filename
    filename = canonical_title.replace('|', '_').replace('/', '_')
    filename = filename.replace('\x00', '').replace('\r', '').replace('\n', ' ')
    return filename.strip()


def rename_dictionary_files(padakanaja_dir='padakanaja', dry_run=True):
    """
    Rename all dictionary files to use canonical names.
    
    Args:
        padakanaja_dir: Directory containing dictionary files
        dry_run: If True, only show what would be renamed without actually renaming
    """
    padakanaja_path = Path(padakanaja_dir)
    if not padakanaja_path.exists():
        print(f"Error: Directory {padakanaja_dir} not found")
        return
    
    title_map = get_dictionary_title_mapping()
    
    # Get all CSV files
    csv_files = sorted(padakanaja_path.glob('*.csv'))
    print(f"Found {len(csv_files)} CSV files\n")
    
    rename_count = 0
    skip_count = 0
    
    for csv_file in csv_files:
        filename_stem = csv_file.stem
        
        # Get canonical title - try exact match first, then try with common typo fixes
        canonical_title = get_dictionary_title(filename_stem, None)
        
        # If not found, try fixing common typos (ಆಡಳತ -> ಆಡಳಿತ)
        if not canonical_title:
            # Try with typo fix
            fixed_stem = filename_stem.replace('ಆಡಳತ', 'ಆಡಳಿತ')
            if fixed_stem != filename_stem:
                canonical_title = get_dictionary_title(fixed_stem, None)
        
        if not canonical_title:
            print(f"⚠ No mapping found for: {filename_stem}")
            skip_count += 1
            continue
        
        # Convert to canonical filename (replace spaces and special chars with underscores)
        canonical_filename = canonical_title.replace('|', '_').replace('/', '_').replace(' ', '_')
        canonical_filename = canonical_filename.replace('\x00', '').replace('\r', '').replace('\n', '_')
        # Remove multiple consecutive underscores
        while '__' in canonical_filename:
            canonical_filename = canonical_filename.replace('__', '_')
        canonical_filename = canonical_filename.strip('_')
        
        # Check if rename is needed
        if filename_stem == canonical_filename:
            print(f"✓ Already correct: {csv_file.name}")
            skip_count += 1
            continue
        
        # Files to rename
        csv_old = csv_file
        csv_new = padakanaja_path / f"{canonical_filename}.csv"
        
        json_old = csv_file.with_suffix('.json')
        json_new = padakanaja_path / f"{canonical_filename}.json"
        
        yaml_old = csv_file.with_suffix('.yml')
        yaml_new = padakanaja_path / f"{canonical_filename}.yml"
        
        print(f"📝 {filename_stem[:50]}...")
        print(f"   → {canonical_filename[:50]}...")
        
        if not dry_run:
            # Rename files
            if csv_old.exists():
                csv_old.rename(csv_new)
                print(f"   ✓ Renamed CSV")
            if json_old.exists():
                json_old.rename(json_new)
                print(f"   ✓ Renamed JSON")
            if yaml_old.exists():
                yaml_old.rename(yaml_new)
                print(f"   ✓ Renamed YAML")
        
        rename_count += 1
    
    print(f"\n{'='*80}")
    print(f"Summary:")
    print(f"  Renamed: {rename_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Total: {len(csv_files)}")
    if dry_run:
        print(f"\n⚠ DRY RUN - No files were actually renamed")
        print(f"Run with --execute to perform the renames")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Rename dictionary files to canonical names')
    parser.add_argument('--execute', action='store_true', help='Actually perform the renames (default is dry-run)')
    parser.add_argument('--dir', default='padakanaja', help='Directory containing dictionary files')
    
    args = parser.parse_args()
    
    rename_dictionary_files(args.dir, dry_run=not args.execute)

