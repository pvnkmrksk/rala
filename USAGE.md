# Dictionary Scraper Usage Guide

## Quick Start

### 1. List All Dictionaries
```bash
python scraper.py --list
```

### 2. Scrape a Single Dictionary
```bash
# Default (Forestry dictionary)
python scraper.py

# Specific dictionary
python scraper.py --dictionary "ಕಂಪ್ಯೂಟರ್ ತಂತ್ರಜ್ಞಾನ ಪದವಿವರಣ ಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ"

# With custom output name
python scraper.py --dictionary "..." --output my_dict

# Headless mode (no browser window)
python scraper.py --dictionary "..." --headless
```

### 3. Scrape ALL Dictionaries (Parallel)
```bash
python scrape_all.py
```

This spawns 74 separate Python processes, one for each English-Kannada dictionary.

## Command-Line Options

### `scraper.py` Options:
- `--list, -l`: List all available English-Kannada dictionaries
- `--dictionary, -d`: Dictionary name to scrape (exact text from dropdown)
- `--headless`: Run in headless mode (no browser window)
- `--output, -o`: Output filename prefix (without extension)

## Examples

```bash
# List dictionaries
python scraper.py --list

# Scrape Forestry dictionary (default)
python scraper.py

# Scrape Computer dictionary with custom name
python scraper.py --dictionary "ಕಂಪ್ಯೂಟರ್ ತಂತ್ರಜ್ಞಾನ ಪದವಿವರಣ ಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ" --output computer

# Scrape all dictionaries in parallel
python scrape_all.py
```

## Monitoring Progress

### Check Running Processes
```bash
ps aux | grep "scraper.py --dictionary" | grep -v grep
```

### Check Output Files
```bash
ls -lh *.json *.csv
```

### Stop All Processes
```bash
pkill -f 'scraper.py --dictionary'
```

## Output Files

Each dictionary is saved as:
- `{dictionary_name}.json` - JSON format with all columns
- `{dictionary_name}.csv` - CSV format with all columns

Files are saved in the current directory.

