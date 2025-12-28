# Scripts Directory

This directory contains scripts organized by function:

## Structure

- **`scraping/`** - Web scraping scripts
  - `scraper_simple.py` - Scrapes dictionary data from padakanaja.karnataka.gov.in

- **`scrubbing/`** - Data cleaning and normalization scripts
  - (To be added as needed)

- **`parsing/`** - Data parsing and conversion scripts
  - `csv_to_yaml_parser.py` - Converts CSV files to YAML format
  - `batch_parse_padakanaja.py` - Batch processes all CSV files in padakanaja/

## Usage

### Scraping
```bash
cd scripts/scraping
python scraper_simple.py
```

### Parsing
```bash
cd scripts/parsing
# Single file
python csv_to_yaml_parser.py ../padakanaja/file.csv

# Batch process all files
python batch_parse_padakanaja.py
```


