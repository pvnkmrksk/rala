# Padakanaja Dictionary Scraper

Simple scraper for Kannada-English dictionaries from [padakanaja.karnataka.gov.in](https://padakanaja.karnataka.gov.in/dictionary).

## Features

- **One-page extraction**: Sets pagination to show all entries on a single page (no pagination needed!)
- **Automatic processing**: Processes all dictionaries sequentially
- **Progress tracking**: Shows progress bar and detailed logs
- **Clean output**: Saves both CSV and JSON formats

## Installation

```bash
# From project root
cd padakanaja

# Create virtual environment (if not already created)
python3 -m venv ../venv
source ../venv/bin/activate  # On Windows: ..\venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt
```

## Usage

```bash
# From padakanaja directory
python scraper_simple.py

# Process first 5 dictionaries (for testing)
python scraper_simple.py --limit 5

# Start from a specific index
python scraper_simple.py --start-from 10

# Run in headless mode (no browser window)
python scraper_simple.py --headless
```

## How It Works

1. Navigates to the dictionary website
2. For each dictionary:
   - Selects the dictionary from dropdown
   - Sets pagination to 2 million (shows all entries on one page)
   - Extracts all entries from the single page
   - Saves to CSV and JSON files in the current directory

## Output

Each dictionary is saved as:
- `{sanitized_name}.csv` - CSV format with all columns
- `{sanitized_name}.json` - JSON format with all entries

All dictionary files are saved in this `padakanaja` directory.

## Requirements

- Python 3.7+
- Chrome browser
- Selenium
- webdriver-manager (optional, for automatic ChromeDriver management)

