# Scripts Directory

This directory contains scripts organized by function for scraping, parsing, and combining dictionary data.

## Structure

- **`scraping/`** - Web scraping scripts
  - `scraper_simple.py` - Scrapes dictionary data from padakanaja.karnataka.gov.in

- **`scrubbing/`** - Data cleaning and normalization scripts
  - (To be added as needed)

- **`parsing/`** - Data parsing and conversion scripts
  - `csv_to_yaml_parser.py` - Converts CSV files to YAML format
  - `batch_parse_padakanaja.py` - Batch processes all CSV files in padakanaja/
  - `combine_dictionaries.py` - Combines all YAML dictionaries into a single file
  - `rename_dictionaries.py` - Renames dictionary files to canonical names (fixes typos)

## Usage

### Prerequisites

1. Activate the virtual environment:
```bash
source ../venv/bin/activate  # From project root
# or
cd .. && source venv/bin/activate  # From scripts directory
```

2. Ensure dependencies are installed:
```bash
pip install -r ../requirements.txt
```

### Step 1: Scraping (if needed)

Scrape dictionary data from padakanaja.karnataka.gov.in:

```bash
cd scripts/scraping
python scraper_simple.py
```

This will:
- Scrape all dictionaries from the website
- Save CSV and JSON files to `padakanaja/` directory
- Preserve Unicode filenames (Mac-compatible)

**Note:** Only run this if you need to refresh the source data. The scraped CSV files are already in the repository.

### Step 2: Fix Filenames (if needed)

If dictionary files have typos in their names, rename them to canonical names:

```bash
cd scripts/parsing
# Dry run (see what would be renamed)
python rename_dictionaries.py

# Actually rename files
python rename_dictionaries.py --execute
```

This uses the canonical title mapping to ensure all filenames use correct spellings.

### Step 3: Parsing CSV to YAML

#### Single File

Convert a single CSV file to YAML:

```bash
cd scripts/parsing
python csv_to_yaml_parser.py ../padakanaja/filename.csv
```

The output YAML file will be created in the same directory with `.yml` extension.

#### Batch Processing

Process all CSV files in the `padakanaja/` directory:

```bash
cd scripts/parsing
python batch_parse_padakanaja.py
```

This will:
- Process all CSV files in `padakanaja/`
- Generate YAML files with correct dictionary titles
- Filter out entries with only English words in Kannada columns
- Split synonyms into separate entries
- Normalize grammar types (e.g., "n" → "Noun")

### Step 4: Combining Dictionaries

Combine all padakanaja YAML files into a single file for better mobile performance:

```bash
cd scripts/parsing
python combine_dictionaries.py
```

This will:
- Load all YAML files from `padakanaja/`
- Combine them into `padakanaja/combined_dictionaries.yml`
- Preserve source information for each entry
- Generate a single file (~142MB) instead of 63 separate files

**Output:** `padakanaja/combined_dictionaries.yml`

## Complete Workflow

To recreate all dictionaries from scratch:

```bash
# 1. Activate virtual environment
source venv/bin/activate

# 2. Scrape (optional - only if source data needs refresh)
cd scripts/scraping
python scraper_simple.py
cd ../..

# 3. Fix filenames (if needed - ensures canonical names)
cd scripts/parsing
python rename_dictionaries.py --execute
cd ../..

# 4. Parse all CSV files to YAML
cd scripts/parsing
python batch_parse_padakanaja.py
cd ../..

# 5. Combine all YAML files
cd scripts/parsing
python combine_dictionaries.py
cd ../..
```

## File Organization

- **CSV files**: `padakanaja/*.csv` - Raw scraped data
- **JSON files**: `padakanaja/*.json` - Metadata from scraping
- **YAML files**: `padakanaja/*.yml` - Parsed dictionary entries (individual dictionaries)
- **Combined YAML**: `padakanaja/combined_dictionaries.yml` - Single combined file for frontend

## Notes

- **Filenames**: The scraper uses canonical title mapping to prevent typos in filenames
- **Filtering**: The parser automatically filters out entries that contain only English words in Kannada columns
- **Synonyms**: Synonyms are split into separate entries for better searchability
- **Titles**: Dictionary titles are corrected using a mapping in `batch_parse_padakanaja.py`
- **Grammar**: Grammar types are normalized to full forms (e.g., "n" → "Noun")
- **Cleaning**: Kannada entries are cleaned (brackets, parentheses removed)
