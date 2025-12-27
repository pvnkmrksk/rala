#!/usr/bin/env python3
"""
Monitor the progress of the running scraper
"""

import os
import time
import json
import glob
from datetime import datetime

def get_file_count(filename):
    """Get entry count from CSV"""
    if os.path.exists(filename):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                return len(f.readlines()) - 1
        except:
            return None
    return None

def get_latest_temp_file():
    """Get the most recently updated temp file"""
    temp_files = glob.glob("*_temp.csv")
    if not temp_files:
        return None
    latest = max(temp_files, key=os.path.getmtime)
    return latest

def monitor():
    print("=" * 80)
    print("MONITORING SCRAPER PROGRESS")
    print("=" * 80)
    print("Press Ctrl+C to stop monitoring\n")
    
    last_file = None
    last_count = 0
    
    try:
        while True:
            # Check if process is running
            import subprocess
            result = subprocess.run(['pgrep', '-f', 'process_all_incomplete'], 
                                  capture_output=True, text=True)
            if not result.stdout.strip():
                print("\n⚠️  Process is not running")
                break
            
            # Get latest temp file
            temp_file = get_latest_temp_file()
            
            if temp_file:
                current_count = get_file_count(temp_file)
                mtime = os.path.getmtime(temp_file)
                mod_time = datetime.fromtimestamp(mtime).strftime('%H:%M:%S')
                
                if temp_file != last_file:
                    print(f"\n📄 Processing: {temp_file}")
                    print(f"   Started at: {mod_time}")
                    last_file = temp_file
                    last_count = 0
                
                if current_count and current_count != last_count:
                    print(f"   [{mod_time}] Entries: {current_count:,} (+{current_count - last_count:,})")
                    last_count = current_count
                elif current_count:
                    print(f"   [{mod_time}] Entries: {current_count:,} (no change)")
            else:
                print("   Waiting for activity...")
            
            time.sleep(5)  # Check every 5 seconds
            
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped")

if __name__ == "__main__":
    monitor()

