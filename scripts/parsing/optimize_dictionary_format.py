#!/usr/bin/env python3
"""
Optimize dictionary format for smaller file size and faster loading.
Groups entries by source/dict_title to avoid repetition.
Uses compact format: [kannada, english, type] instead of verbose objects.
"""

import json
from pathlib import Path
from typing import List, Dict, Any


def optimize_entries(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Optimize dictionary entries by:
    1. Grouping by source/dict_title to avoid repetition
    2. Using compact array format: [kannada, english, type]
    3. Removing redundant fields (head, id for padakanaja)
    """
    sources = {}
    
    for entry in entries:
        src = entry.get('source', '')
        dt = entry.get('dict_title', '')
        key = (src, dt)
        
        if key not in sources:
            sources[key] = []
        
        # Get English and type from defs
        english = ''
        type_str = ''
        if entry.get('defs') and len(entry.get('defs', [])) > 0:
            def_entry = entry['defs'][0]
            english = def_entry.get('entry', '')
            type_str = def_entry.get('type', '')
        
        # Compact format: [kannada, english, type]
        # Only include type if it exists (most padakanaja entries don't have it)
        if type_str:
            opt_entry = [entry['entry'], english, type_str]
        else:
            opt_entry = [entry['entry'], english]
        
        sources[key].append(opt_entry)
    
    # Structure: {source: {dict_title: [[k, e, t?], ...]}}
    optimized = {}
    for (src, dt), entries_list in sources.items():
        if src not in optimized:
            optimized[src] = {}
        optimized[src][dt] = entries_list
    
    return optimized


def deoptimize_entries(optimized: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Convert optimized format back to original format for compatibility.
    """
    entries = []
    
    for src, dicts in optimized.items():
        for dt, entries_list in dicts.items():
            for entry_data in entries_list:
                # Handle both [k, e] and [k, e, t] formats
                if len(entry_data) == 3:
                    kannada, english, type_str = entry_data
                else:
                    kannada, english = entry_data
                    type_str = ''
                
                entry = {
                    'entry': kannada,
                    'defs': [{
                        'entry': english,
                        'type': type_str
                    }],
                    'source': src,
                    'dict_title': dt
                }
                entries.append(entry)
    
    return entries


def optimize_file(input_file: str, output_file: str):
    """Optimize a dictionary file."""
    print(f"Loading: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    
    original_size = len(json.dumps(entries, ensure_ascii=False))
    print(f"  Original: {len(entries)} entries, {original_size / 1024 / 1024:.2f} MB")
    
    optimized = optimize_entries(entries)
    
    # Save optimized
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(optimized, f, ensure_ascii=False, separators=(',', ':'))  # No spaces
    
    optimized_size = Path(output_file).stat().st_size
    reduction = (1 - optimized_size / original_size) * 100
    
    print(f"  Optimized: {optimized_size / 1024 / 1024:.2f} MB ({reduction:.1f}% reduction)")
    print(f"  Saved: {(original_size - optimized_size) / 1024 / 1024:.2f} MB")


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python optimize_dictionary_format.py <input_file> [output_file]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.json', '_optimized.json')
    
    optimize_file(input_file, output_file)

