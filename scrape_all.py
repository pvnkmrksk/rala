#!/usr/bin/env python3
"""
Helper script to spawn separate processes for each English-Kannada dictionary
"""

import subprocess
import sys
import os
from scraper import get_all_dictionaries

def main():
    print("Fetching list of English-Kannada dictionaries...")
    dicts = get_all_dictionaries()
    
    if not dicts:
        print("No dictionaries found!")
        return
    
    print(f"\nFound {len(dicts)} English-Kannada dictionaries")
    print("\nSpawning separate processes for each dictionary...\n")
    
    processes = []
    
    for i, dict_info in enumerate(dicts, 1):
        dict_name = dict_info['text']
        # Create safe filename
        safe_name = "".join(c for c in dict_name[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
        safe_name = safe_name.replace(' ', '_').replace('|', '_').replace('/', '_')
        
        print(f"[{i}/{len(dicts)}] Starting process for: {dict_name[:60]}...")
        
        # Spawn a separate Python process
        cmd = [
            sys.executable,
            'scraper.py',
            '--dictionary', dict_name,
            '--output', safe_name,
            '--headless'  # Run in headless mode to avoid too many windows
        ]
        
        # Start process (don't wait for it)
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        processes.append({
            'process': process,
            'name': dict_name,
            'safe_name': safe_name
        })
        
        print(f"  → Process PID: {process.pid}, Output: {safe_name}.json/csv")
    
    print(f"\n✓ Spawned {len(processes)} processes")
    print("\nAll processes are running in the background.")
    print("Check the output files (*.json and *.csv) to see progress.")
    print("\nTo monitor processes, you can use:")
    print("  ps aux | grep scraper.py")
    print("\nTo kill all processes:")
    print("  pkill -f 'scraper.py --dictionary'")

if __name__ == "__main__":
    main()

