# CSV to YAML Dictionary Parser

This parser converts CSV dictionary files to YAML format compatible with the Rala dictionary structure. The output format matches the existing Alar dictionary structure, allowing easy integration with the current search functionality.

## Overview

The parser reads CSV files containing English-Kannada dictionary entries and converts them to YAML format that can be directly used by the Rala dictionary search system. Each entry includes:

- **entry**: Kannada word or meaning
- **defs**: Array of English definitions
- **id**: Unique identifier for the entry
- **source**: Source dictionary name (for filtering/tagging)
- **head**: Head word (typically the first English word)
- **phone**: Pronunciation (when available)

## Requirements

- Python 3.6+
- PyYAML (`pip install pyyaml`)

## Usage

### Basic Usage

```bash
python csv_to_yaml_parser.py <csv_file> [output_file] [source_name]
```

### Examples

```bash
# Convert a CSV file (output filename auto-generated)
python csv_to_yaml_parser.py "ಕಷ_ವಜಞನ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ.csv"

# Specify output filename
python csv_to_yaml_parser.py "ಕಷ_ವಜಞನ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ.csv" "output.yml"

# Specify output filename and source name
python csv_to_yaml_parser.py "ಕಷ_ವಜಞನ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ.csv" "output.yml" "ಕಷ ವಿಜ್ಞಾನ ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ"
```

## CSV Format

The parser expects CSV files with the following columns (column names can vary):

- **ಕನ್ನಡ ಪದ (Kannada Word)** - Kannada word (can be empty, will use Kannada meaning)
- **ಇಂಗ್ಲೀಷ್ ಪದ (English Word)** - English word (required)
- **ಕನ್ನಡ ಅರ್ಥ (Kannada Meaning)** - Kannada meaning/translation
- **ಕನ್ನಡ ಉಚ್ಚಾರಣೆ (Kannada Pronunciation)** - Pronunciation guide
- **ಇಂಗ್ಲೀಷ್ ಅರ್ಥ (English Meaning)** - English meaning/definition
- **ಪರ್ಯಾಯ ಪದ (Synonyms)** - Synonyms
- **ವಿಷಯ ವರ್ಗೀಕರಣ (Subject)** - Subject classification
- **ವ್ಯಾಕರಣ ವಿಶೇಷ (Grammer)** - Grammar information
- **ಇಲಾಖೆ (Department)** - Department
- **ಸಂಕ್ಷಿಪ್ತ ವಿವರಣೆ (Short Description)** - Short description
- **ದೀರ್ಘ ವಿವರಣೆ (Long Description)** - Long description
- **ಆಡಳಿತಾತ್ಮಕ ಪದ (Administrative Word)** - Administrative word flag

The parser automatically detects column names and maps them appropriately.

## Output Format

The YAML output follows this structure:

```yaml
- entry: ಮುತ್ತಿನ ಚಿಪ್ಪು
  defs:
  - entry: Abalone
    type: n
  - entry: Nacre
    type: n
  id: abalone_b6f9ee5a858a
  source: ಕಷ ವಿಜ್ಞಾನ ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ
  head: Abalone
  phone: ಮುತ್ತಿನ ಚಿಪ್ಪು  # Optional, when available
```

### Entry Fields

- **entry**: The Kannada word or meaning (primary identifier)
- **defs**: Array of definition objects, each containing:
  - **entry**: English definition text
  - **type**: Part of speech type (default: 'n' for noun)
- **id**: Unique identifier (hash-based, readable prefix + hash)
- **source**: Source dictionary name (for later filtering)
- **head**: Head word (typically the first English word)
- **phone**: Pronunciation guide (optional, when available in CSV)

## Features

1. **Automatic Column Detection**: Handles various column name formats
2. **Grouping**: Groups multiple English definitions under the same Kannada word
3. **Source Tagging**: Tags each entry with its source dictionary
4. **Clean IDs**: Generates short, readable, unique IDs using hash-based approach
5. **Unicode Support**: Fully supports Kannada and English text
6. **Error Handling**: Skips rows with missing essential data

## Integration with Rala

The generated YAML files can be integrated with the Rala dictionary system:

1. **Multiple Sources**: Each entry is tagged with its `source` field, allowing filtering by dictionary
2. **Compatible Structure**: Matches the existing Alar dictionary format
3. **Easy Extension**: The search code can be extended to support multiple dictionaries with minimal changes

### Future Integration

To integrate multiple dictionaries:

1. Merge YAML files or load them separately
2. Filter by `source` field when needed
3. Display source information in search results
4. Allow users to filter by dictionary source

## Notes

- Rows without an English word are skipped
- When Kannada word is empty, the Kannada meaning is used as the entry
- Multiple English words mapping to the same Kannada word are grouped together
- Pronunciation is included when available in the CSV
- Grammar type defaults to 'n' (noun) but can be customized based on grammar field

## Example Output

```bash
$ python csv_to_yaml_parser.py "ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ.csv"

Parsing CSV file: ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ.csv
Source dictionary: ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ
Found columns: ['kannada_word', 'english_word', 'kannada_meaning', ...]
Processed 149 rows
Found 149 unique Kannada words
Created 149 YAML entries
Saving 149 entries to ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ.yml
✓ YAML file saved: ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ.yml

✓ Conversion complete!
  Input:  ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ.csv
  Output: ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ.yml
  Entries: 149
```

