# Clean Dictionary Scraper

## Overview
Refactored scraper that processes one dictionary at a time with:
- Clean, simple code
- Proper verification at each step
- Comprehensive logging
- Small window size (1/8 screen) for easy positioning
- Uses specific next button selector: `#myTable10_next`

## Usage

### List all dictionaries
```bash
python scraper_clean.py --list
```

### Scrape a single dictionary
```bash
python scraper_clean.py --dictionary "ಕೀಟಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ |ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ" --output output_name
```

### Or use the helper script
```bash
python run_one_dict.py "ಕೀಟಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ |ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ"
```

### Retry all incomplete dictionaries
```bash
python retry_incomplete_clean.py
```

## Features

1. **One dictionary at a time** - Simple, focused execution
2. **Proper verification** - Checks each step before proceeding
3. **Comprehensive logging** - Shows:
   - Dictionary name
   - Total records and pages
   - Current page number
   - Entries extracted per page
   - Total progress
4. **Small window** - 480x540 pixels for easy positioning
5. **Specific selectors** - Uses `#myTable10_next` for next button
6. **Progress saving** - Saves after each page

## Log Output Example

```
================================================================================
STARTING SCRAPE
================================================================================
Dictionary: ಕೀಟಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ

================================================================================
TABLE INFORMATION
================================================================================
Total Records: 1,992
Total Pages: 10
Entries per page: 200
================================================================================

================================================================================
PAGE 1/10
================================================================================
Current Page (from DataTables): 1
Records on this page: 200
Extracting entries from current page...
✓ Extracted 200 entries from page 1
📊 TOTAL ENTRIES SO FAR: 200/1,992
📊 PROGRESS: 10.0%
💾 Saved progress to output_temp.csv
Clicking next button...
✓ Clicked next button
```

