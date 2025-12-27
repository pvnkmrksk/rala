#!/usr/bin/env python3
"""
Fix remaining incomplete dictionaries
"""

import subprocess
import sys

# Remaining problematic dictionaries with exact names
REMAINING_DICTS = {
    "ತಟಗರಕ_ಇಲಖ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ": "ತಟಾಕರ ಇಲಾಖೆ ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಮತ್ತು ಸಂಸ್ಕೃತಿ ಇಲಾಖೆ (2015)",
    "ತಟಗರಕ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರ": "ತಟಾಕರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ (2015)",
    "ಕಷ_ವಜಞನ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ": "ಕೃಷಿ ವಿಜ್ಞಾನ ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಅಭಿವೃದ್ಧಿ ಪ್ರಾಧಿಕಾರ (2004)"
}

def main():
    print("=" * 80)
    print("Fixing Remaining Incomplete Dictionaries")
    print("=" * 80)
    
    print(f"\nRe-scraping {len(REMAINING_DICTS)} dictionaries...")
    print("=" * 80)
    
    success_count = 0
    fail_count = 0
    
    for filename, dict_name in REMAINING_DICTS.items():
        print(f"\n[{list(REMAINING_DICTS.keys()).index(filename) + 1}/{len(REMAINING_DICTS)}] {dict_name[:60]}...")
        print(f"    Output: {filename}.json/csv")
        print(f"    Browser will be visible for debugging")
        
        cmd = [
            sys.executable,
            'scraper.py',
            '--dictionary', dict_name,
            '--output', filename
        ]
        
        print(f"    → Running: {' '.join(cmd[:3])} ...")
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        process.wait()
        
        if process.returncode == 0:
            success_count += 1
            print(f"  ✓ {dict_name[:50]} - SUCCESS")
        else:
            fail_count += 1
            stderr = process.stderr.read() if process.stderr else "No error"
            print(f"  ✗ {dict_name[:50]} - FAILED")
            if stderr:
                print(f"    Error: {stderr[:300]}")
    
    print("\n" + "=" * 80)
    print("FINAL SUMMARY:")
    print("=" * 80)
    print(f"Successfully re-scraped: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Total: {len(REMAINING_DICTS)}")

if __name__ == "__main__":
    main()

