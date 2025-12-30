# Padakanaja Dictionary Scraper

Scraper for Kannada-English dictionaries from [padakanaja.karnataka.gov.in](https://padakanaja.karnataka.gov.in/dictionary).

## Overview

This scraper extracts dictionary data from the Karnataka Government's Padakanaja dictionary portal. The portal contains multiple specialized dictionaries covering various domains (agriculture, administration, science, etc.).

## Features

- **One-page extraction**: Sets pagination to show all entries on a single page (no pagination needed!)
- **Automatic processing**: Processes all dictionaries sequentially
- **Progress tracking**: Shows progress bar and detailed logs
- **Clean output**: Saves both CSV and JSON formats
- **YAML format**: Also saves in Alar-compatible YAML format for posterity

## Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt
```

## Usage

```bash
# Process all dictionaries
python scraper_simple.py

# Process first 5 dictionaries (for testing)
python scraper_simple.py --limit 5

# Start from a specific index
python scraper_simple.py --start-from 10

# Run in headless mode (no browser window)
python scraper_simple.py --headless
```

## Output

Each dictionary is saved as:
- `{sanitized_name}.csv` - CSV format with all columns
- `{sanitized_name}.json` - JSON format with all entries
- `{sanitized_name}.yml` - YAML format (Alar-compatible)

Files are saved in the `../padakanaja/` directory.

## Data Source

All dictionary data is sourced from the [Karnataka Government's Padakanaja portal](https://padakanaja.karnataka.gov.in/dictionary). This is a public resource maintained by the Government of Karnataka.

## Requirements

- Python 3.7+
- Chrome browser
- Selenium
- webdriver-manager (optional, for automatic ChromeDriver management)

