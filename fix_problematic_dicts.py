#!/usr/bin/env python3
"""
Fix all problematic dictionaries identified by the user
"""

import subprocess
import sys
from scraper import get_all_dictionaries

# Dictionary mappings: filename -> exact dictionary name from the list
PROBLEMATIC_DICTS = {
    "ಕಟಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ_ಇಗಲಷ-ಕನನಡ__ಪರ": "ಕೀಟಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ |ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕೃಷಿ ವಿಶ್ವವಿದ್ಯಾನಿಲಯ (1981)",
    "ಕಪಯಟರ_ತತರಜಞನ_ಪದವವರಣ_ಕಶ__ಇಗಲಷ-ಕನನಡ": "ಕಂಪ್ಯೂಟರ್ ತಂತ್ರಜ್ಞಾನ ಪದವಿವರಣ ಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ |ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ (2017)",
    "ಕಷ_ವಜಞನ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ": "ಕೃಷಿ ವಿಜ್ಞಾನ ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ (2004)",
    "ಖಜನ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-_ಕನನಡ_ಮ": "ಖಜಾನೆ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಮತ್ತು ಸಂಸ್ಕೃತಿ ಇಲಾಖೆ",
    "ಜವ_ಇಗಲಷ_-_ಕನನಡ_ನಘಟ__ಇಗಲಷ-ಕನನಡ__ಪ": "ಜೀವಿ ಇಂಗ್ಲೀಷ್ - ಕನ್ನಡ ನಿಘಂಟು | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಪ್ರಿಸಮ್ ಬುಕ್ಸ್ ಪ್ರೈವೇಟ್ ಲಿಮಿಟೆಡ್ (2001)",
    "ತಟಗರಕ_ಇಲಖ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ": "ತಟಾಕರ ಇಲಾಖೆ ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಮತ್ತು ಸಂಸ್ಕೃತಿ ಇಲಾಖೆ (2015)",
    "ತಟಗರಕ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರ": "ತಟಾಕರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ (2015)",
    "ನವಕರನಟಕ_ಆಡಳತ_ಪದಕಶ_ಕನನಡ-ಇಗಲಷ-ಕನನಡ_ಪರಕ": "ನವಕರ್ನಾಟಕ ಆಡಳಿತ ಪದಕೋಶ |ಕನ್ನಡ-ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ) |ಪ್ರಕಾಶಕರು - ನವಕರ್ನಾಟಕ ಪಬ್ಲಿಕೇಷನ್ಸ್‌ ಪ್ರೈವೇಟ್ ಲಿಮಿಟೆಡ್ (2013)",
    "ಪತರಕ_ನಘಟ_-_ಎಲ_ಗಡಪಪ__ಇಗಲಷ-ಕನನಡ": "ಪತ್ರಿಕಾ ನಿಘಂಟು - ಎಲ್‌. ಗುಂಡಪ್ಪ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಲೋಕ ಶಿಕ್ಷಣ ಟ್ರಸ್ಟ್ ಪ್ರಕಾಶನ (2001)"
}

def main():
    print("=" * 80)
    print("Fixing Problematic Dictionaries")
    print("=" * 80)
    
    print(f"\nRe-scraping {len(PROBLEMATIC_DICTS)} dictionaries...")
    print("=" * 80)
    
    # Process in batches of 3
    batch_size = 3
    items = list(PROBLEMATIC_DICTS.items())
    batches = [items[i:i+batch_size] for i in range(0, len(items), batch_size)]
    
    success_count = 0
    fail_count = 0
    
    for batch_num, batch in enumerate(batches, 1):
        print(f"\n{'='*80}")
        print(f"BATCH {batch_num}/{len(batches)} - Processing {len(batch)} dictionaries")
        print(f"{'='*80}")
        
        processes = []
        for filename, dict_name in batch:
            print(f"\n[{batch.index((filename, dict_name)) + 1}/{len(batch)}] {dict_name[:60]}...")
            print(f"    Output: {filename}.json/csv")
            print(f"    Browser will be visible for debugging")
            
            cmd = [
                sys.executable,
                'scraper.py',
                '--dictionary', dict_name,
                '--output', filename
            ]
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            processes.append({
                'process': process,
                'name': dict_name,
                'filename': filename
            })
            
            print(f"    → Process PID: {process.pid}")
        
        # Wait for batch to complete
        print(f"\n⏳ Waiting for batch {batch_num} to complete...")
        for proc_info in processes:
            proc_info['process'].wait()
            if proc_info['process'].returncode == 0:
                success_count += 1
                print(f"  ✓ {proc_info['name'][:50]} - SUCCESS")
            else:
                fail_count += 1
                stderr = proc_info['process'].stderr.read() if proc_info['process'].stderr else "No error"
                print(f"  ✗ {proc_info['name'][:50]} - FAILED")
                if stderr:
                    print(f"    Error: {stderr[:300]}")
        
        if batch_num < len(batches):
            print(f"\n⏸️  Waiting 15 seconds before next batch...")
            import time
            time.sleep(15)
    
    print("\n" + "=" * 80)
    print("FINAL SUMMARY:")
    print("=" * 80)
    print(f"Successfully re-scraped: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Total: {len(PROBLEMATIC_DICTS)}")

if __name__ == "__main__":
    main()
