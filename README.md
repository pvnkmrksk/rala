# Rala (ರಲ)

**English → Kannada dictionary. An amateur reversal of V. Krishna's Alar**

**🌐 Live Site**: [https://pvnkmrksk.github.io/rala/](https://pvnkmrksk.github.io/rala/)

---

Rala is a reverse dictionary that helps you find Kannada words by searching for their English meanings. Unlike traditional dictionaries where you look up a Kannada word to find its English definition, Rala works in reverse—enter an English word or concept, and discover the corresponding Kannada words.

**Rala** (ರಲ) = Reverse **Alar** — an amateur, uneducated attempt at reversing V. Krishna's excellent [Alar](https://alar.ink) Kannada → English dictionary.

## ✨ Features

- **🔍 Exact Matches**: Find Kannada words that directly contain your search term in their definitions
- **🔗 Synonym Matches**: Discover related Kannada words through synonyms and similar meanings using the Datamuse API
- **⚡ Automatic Sequential Loading**: Exact matches appear instantly, followed by synonym matches
- **📑 Sticky Navigation**: Search bar and result tabs stay visible while scrolling
- **⌨️ Real-time Search**: Instant results as you type (with smart debouncing)
- **🎯 Smart Scrolling**: Click tabs to automatically scroll to the relevant section

## 🚀 How It Works

1. Enter an English word or phrase in the search box
2. **Exact matches** appear first, showing Kannada words whose definitions directly contain your search term
3. **Synonym matches** load automatically (after a 500ms delay, or immediately on Enter key press)
4. Click the **Exact Match** or **Synonym Match** tabs to navigate between sections
5. Results scroll smoothly to keep the relevant section in view

## 🏗️ Technical Details

- **Dictionary Data**: Loaded from the [Alar YAML file](https://github.com/alar-dict/data) hosted on GitHub
- **Synonym Matching**: Powered by the [Datamuse API](https://www.datamuse.com/api/)
- **Architecture**: Fully client-side processing—all search happens in your browser
- **No Backend**: No server required, works entirely with static hosting

## 📚 Attribution

This project is built using dictionary data from [Alar](https://alar.ink), created by **V. Krishna**.

- **Original Dictionary**: [Alar - Kannada → English Dictionary](https://alar.ink)
- **Source Data**: [alar-dict/data on GitHub](https://github.com/alar-dict/data)
- **Data License**: [Open Database License (ODC-ODbL)](https://opendatacommons.org/licenses/odbl/)

## 📄 License

This project and its code are licensed under the [Open Database License (ODC-ODbL)](https://opendatacommons.org/licenses/odbl/), inheriting from the source dictionary data license.

The dictionary data is provided by [Alar](https://alar.ink) and is also licensed under ODC-ODbL. For more information about the data license, please refer to the [Alar project](https://alar.ink).

