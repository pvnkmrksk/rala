# Rala - English to Kannada Dictionary

**ರಲ** = Reverse [Alar](https://alar.ink)

A fast, offline-capable English → Kannada dictionary combining:
- **Alar Dictionary** by V. Krishna (156,672 entries)
- **Padakanaja Dictionaries** from Karnataka Government (322,008 entries)

**Total: 478,680 entries | 103,585 unique English words**

🌐 **Live Site**: [https://pvnkmrksk.github.io/rala/](https://pvnkmrksk.github.io/rala/)

![Rala Dictionary Demo](rala-demo-test.png)

## Features

- ⚡ **Fast Search**: Hybrid architecture with Cloudflare Worker API + local caching
- 🔍 **Smart Matching**: Whole-word matching (no false positives from substrings)
- 🔄 **Word Forms**: Automatic detection of word endings (escalation → escalate, escalating, etc.)
- 📱 **Offline Support**: Alar dictionary cached locally for offline use
- 🌙 **Dark Mode**: Built-in dark mode support
- 📱 **PWA**: Installable as a Progressive Web App

## Architecture

- **Frontend**: Static site hosted on GitHub Pages
- **Backend**: Cloudflare Worker API for Padakanaja dictionary (322k entries)
- **Local**: Alar dictionary (156k entries) loaded client-side for offline support
- **Search**: Combines results from both sources in real-time

## Data Sources

### Alar Dictionary
- **Source**: [V. Krishna's Alar](https://alar.ink)
- **License**: ODC-ODbL
- **Entries**: 156,672
- **Format**: YAML (preserved for posterity)

### Padakanaja Dictionaries
- **Source**: [Karnataka Government Padakanaja Portal](https://padakanaja.karnataka.gov.in/dictionary)
- **Publisher**: Government of Karnataka
- **Entries**: 322,008 (combined from multiple specialized dictionaries)
- **Format**: CSV/JSON (scraped and processed)

## Development

### Local Setup

```bash
# Start local server
./test-local.sh

# Or manually
python3 -m http.server 8000
```

### Cloudflare Worker Deployment

```bash
cd workers
npx wrangler deploy
```

### Dictionary Processing

See `scripts/` directory for:
- `scraping/` - Scrapers for Padakanaja dictionaries
- `parsing/` - Scripts to process and optimize dictionary data

## Attribution

- **Alar Dictionary**: Dictionary data by [V. Krishna](https://alar.ink), licensed under [ODC-ODbL](https://opendatacommons.org/licenses/odbl/)
- **Padakanaja Dictionaries**: Sourced from [Karnataka Government Padakanaja Portal](https://padakanaja.karnataka.gov.in/dictionary), maintained by Government of Karnataka
- **Source Data**: [Alar Dictionary Data](https://github.com/alar-dict/data)

## License

- Alar data: ODC-ODbL
- Padakanaja data: Public domain (Government of Karnataka)
- Code: See repository license

---

Made with ❤️ by [pvnkmrksk](https://github.com/pvnkmrksk)
