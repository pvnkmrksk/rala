# Dictionary Scraper for Padakanaja

This scraper extracts English to Kannada dictionary entries from the Karnataka Government's Padakanaja dictionary portal.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install ChromeDriver:
   - Option 1: Install via Homebrew (macOS): `brew install chromedriver`
   - Option 2: Download from https://chromedriver.chromium.org/
   - Option 3: Use webdriver-manager (automatically handles driver)

## Usage

### List All Available Dictionaries

```bash
python scraper.py --list
```

This will show all available English-Kannada dictionaries.

### Scrape Single Dictionary

```bash
# Scrape default Forestry dictionary
python scraper.py

# Scrape a specific dictionary by name
python scraper.py --dictionary "ಅರಣ್ಯಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ"

# Scrape with custom output filename
python scraper.py --dictionary "ಕಂಪ್ಯೂಟರ್ ತಂತ್ರಜ್ಞಾನ ಪದವಿವರಣ ಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ" --output computer_dict

# Run in headless mode (no browser window)
python scraper.py --dictionary "..." --headless
```

### Scrape All English-Kannada Dictionaries (Parallel)

```bash
python scrape_all.py
```

This will:
- Fetch the list of all English-Kannada dictionaries
- Spawn a separate Python process for each dictionary
- Each process runs independently in headless mode
- Output files are saved as `{dictionary_name}.json` and `{dictionary_name}.csv`

**Note:** All processes run in parallel. Monitor progress by checking the output files or using:
```bash
ps aux | grep scraper.py
```

To stop all processes:
```bash
pkill -f 'scraper.py --dictionary'
```

## Output Format

The scraper saves data in two formats:

### JSON Format
```json
[
  {
    "Column_1": "English word",
    "Column_2": "Kannada word",
    "Column_3": "Additional details"
  }
]
```

### CSV Format
Standard CSV with headers matching the table columns from the website.

## Features

- ✅ Automatic dictionary selection from dropdown
- ✅ Pagination handling (200 entries per page)
- ✅ Extracts all columns from the table
- ✅ Handles multiple pages automatically
- ✅ Saves data in both JSON and CSV formats
- ✅ Can scrape all English-Kannada dictionaries
- ✅ Robust error handling and logging

## Notes

- The scraper uses Selenium with Chrome browser
- Set `headless=True` in `DictionaryScraper()` to run without opening browser window
- The scraper includes delays to handle page loading times
- All extracted data is saved with UTF-8 encoding to preserve Kannada characters

