#!/usr/bin/env python3
"""
Simple dictionary scraper - shows all entries on one page
"""

import time
import json
import csv
import os
import sys
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Try to use webdriver-manager if available
try:
    from webdriver_manager.chrome import ChromeDriverManager
    WEBDRIVER_MANAGER_AVAILABLE = True
except ImportError:
    WEBDRIVER_MANAGER_AVAILABLE = False


class SimpleDictionaryScraper:
    def __init__(self, headless=False):
        """Initialize scraper with small window size"""
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='[%(asctime)s] %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
            force=True
        )
        self.logger = logging.getLogger(__name__)
        
        # Setup Chrome options
        chrome_options = Options()
        if headless:
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
        
        # Set window size to 1/8 of screen
        chrome_options.add_argument('--window-size=480,540')
        
        # Initialize driver
        if WEBDRIVER_MANAGER_AVAILABLE:
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
        else:
            self.driver = webdriver.Chrome(options=chrome_options)
        
        # Position window
        self.driver.set_window_position(0, 0)
        
        self.wait = WebDriverWait(self.driver, 30)
        self.base_url = "https://padakanaja.karnataka.gov.in/dictionary"
        self.scraped_data = []
        
        self.logger.info("=" * 80)
        self.logger.info("SIMPLE SCRAPER INITIALIZED")
        self.logger.info("=" * 80)
    
    def navigate_to_dictionary(self):
        """Navigate to dictionary page"""
        self.logger.info(f"Navigating to: {self.base_url}")
        self.driver.get(self.base_url)
        time.sleep(2)
        self.logger.info("✓ Page loaded")
    
    def get_all_dictionaries(self):
        """Get list of all dictionaries from dropdown"""
        try:
            dropdown = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//select[contains(@class, 'form-control')]"))
            )
            select = Select(dropdown)
            options = select.options
            
            dictionaries = []
            for option in options:
                text = option.text.strip()
                if text and ('ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ' in text or 'ಕನ್ನಡ-ಇಂಗ್ಲೀಷ್' in text):
                    dictionaries.append({
                        'text': text,
                        'value': option.get_attribute('value')
                    })
            
            self.logger.info(f"✓ Found {len(dictionaries)} English-Kannada dictionaries")
            return dictionaries
        except Exception as e:
            self.logger.error(f"Error getting dictionaries: {e}")
            return []
    
    def select_dictionary(self, dictionary_name):
        """Select dictionary from dropdown"""
        try:
            dropdown = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//select[contains(@class, 'form-control')]"))
            )
            select = Select(dropdown)
            select.select_by_visible_text(dictionary_name)
            self.logger.info(f"✓ Selected: {dictionary_name[:60]}...")
            time.sleep(2)  # Wait for table to load
            return True
        except Exception as e:
            self.logger.error(f"✗ Error selecting dictionary: {e}")
            return False
    
    def set_pagination_to_all(self):
        """Set pagination to show all entries (2 million)"""
        try:
            # Wait for pagination dropdown - try multiple selectors
            selectors = [
                (By.NAME, "myTable10_length"),
                (By.CSS_SELECTOR, "#myTable10_length"),
                (By.XPATH, "//select[contains(@name, 'length')]"),
                (By.CSS_SELECTOR, "select[name*='length']")
            ]
            
            pagination_dropdown = None
            for by, selector in selectors:
                try:
                    pagination_dropdown = self.wait.until(
                        EC.presence_of_element_located((by, selector))
                    )
                    break
                except:
                    continue
            
            if not pagination_dropdown:
                self.logger.error("Could not find pagination dropdown")
                return False
            
            # Use JavaScript to set a very large value and trigger DataTables update
            success = self.driver.execute_script("""
                // Try multiple methods to set pagination
                var select = document.querySelector('select[name="myTable10_length"]') || 
                            document.querySelector('#myTable10_length') ||
                            document.querySelector('select[name*="length"]');
                
                if (!select) {
                    return false;
                }
                
                // Add option with large value if it doesn't exist
                var largeOption = select.querySelector('option[value="2000000"]');
                if (!largeOption) {
                    var option = document.createElement('option');
                    option.value = '2000000';
                    option.text = 'All';
                    select.appendChild(option);
                }
                
                // Set the value
                select.value = '2000000';
                
                // Trigger DataTables change event
                var table = jQuery('#myTable10').DataTable();
                if (table) {
                    // Use DataTables API to set page length
                    table.page.len(2000000).draw();
                } else {
                    // Fallback: trigger change event
                    var event = new Event('change', { bubbles: true });
                    select.dispatchEvent(event);
                }
                
                return true;
            """)
            
            if not success:
                self.logger.warning("JavaScript pagination setting may have failed, trying direct select...")
                # Fallback: use Selenium Select
                try:
                    from selenium.webdriver.support.ui import Select
                    select = Select(pagination_dropdown)
                    # Try to select by value
                    select.select_by_value('2000000')
                except:
                    pass
            
            self.logger.info("✓ Set pagination to show all entries")
            
            # Wait for table to reload with all entries
            self.logger.info("⏳ Waiting for all entries to load...")
            
            # Wait for DataTables processing to complete
            self.wait.until(
                EC.invisibility_of_element_located((By.ID, "myTable10_processing"))
            )
            
            time.sleep(3)  # Additional wait for all entries to render
            
            return True
        except Exception as e:
            self.logger.error(f"✗ Error setting pagination: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def extract_all_data(self):
        """Extract all data from the single page"""
        try:
            self.logger.info("Extracting all entries from page...")
            
            # Get headers
            headers = self.driver.execute_script("""
                var headers = [];
                jQuery('#myTable10 thead th').each(function() {
                    headers.push(jQuery(this).text().trim());
                });
                return headers;
            """)
            
            self.logger.info(f"✓ Found {len(headers)} columns")
            
            # Get all data
            all_data = self.driver.execute_script("""
                var data = [];
                jQuery('#myTable10 tbody tr').each(function() {
                    var row = {};
                    jQuery(this).find('td').each(function(index) {
                        var text = jQuery(this).text().trim();
                        text = text.replace(/[\\s\\n\\r]+/g, ' ');
                        row['cell_' + index] = text;
                    });
                    data.push(row);
                });
                return data;
            """)
            
            # Convert to proper format
            entries = []
            for row_dict in all_data:
                entry = {}
                for i, header in enumerate(headers):
                    cell_key = f'cell_{i}'
                    cell_value = row_dict.get(cell_key, '').strip()
                    if cell_value:
                        cell_value = ' '.join(cell_value.split())
                    entry[header] = cell_value
                
                # Only add if entry has at least one non-empty field
                if any(v for v in entry.values() if v):
                    entries.append(entry)
            
            self.logger.info(f"✓ Extracted {len(entries)} entries")
            return entries
        except Exception as e:
            self.logger.error(f"Error extracting data: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def scrape_dictionary(self, dictionary_name):
        """Scrape a single dictionary"""
        self.logger.info("=" * 80)
        self.logger.info(f"SCRAPING: {dictionary_name}")
        self.logger.info("=" * 80)
        
        # Select dictionary
        if not self.select_dictionary(dictionary_name):
            return None
        
        # Set pagination to show all
        if not self.set_pagination_to_all():
            return None
        
        # Extract all data
        data = self.extract_all_data()
        
        if data:
            self.logger.info(f"✅ Successfully extracted {len(data)} entries")
        else:
            self.logger.warning("⚠️  No data extracted")
        
        return data
    
    def save_to_csv(self, filename, data):
        """Save data to CSV"""
        if not data:
            return
        
        headers = list(data[0].keys())
        
        with open(filename, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data)
        
        self.logger.info(f"✓ Saved {len(data)} entries to {filename}")
    
    def save_to_json(self, filename, data):
        """Save data to JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"✓ Saved {len(data)} entries to {filename}")
    
    def close(self):
        """Close browser"""
        self.driver.quit()
        self.logger.info("Browser closed")


def sanitize_filename(name):
    """Convert dictionary name to safe filename - preserve full Unicode names for Mac compatibility"""
    # Mac can handle full Unicode filenames, so preserve the original name
    # Only replace characters that are problematic for filesystems
    # Replace pipe and slash with underscore, but keep spaces and other Unicode
    safe = name.replace('|', '_').replace('/', '_')
    # Remove any null bytes or other truly problematic chars
    safe = safe.replace('\x00', '').replace('\r', '').replace('\n', ' ')
    return safe.strip()

def get_proper_filename(dict_name):
    """
    Get proper filename from dictionary name using canonical title mapping.
    This ensures filenames use correct spellings without typos.
    """
    import sys
    from pathlib import Path
    
    # Add parent directory to path for imports
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    
    try:
        from scripts.parsing.batch_parse_padakanaja import get_dictionary_title
        
        # Create a temp filename from dict_name to look up
        temp_filename = dict_name.replace('|', '_').replace('/', '_').replace(' ', '_').strip()
        
        # Get canonical title from mapping
        canonical_title = get_dictionary_title(temp_filename, None)
        
        # If not found, try with common typo fix (ಆಡಳತ -> ಆಡಳಿತ)
        if not canonical_title:
            fixed_temp = temp_filename.replace('ಆಡಳತ', 'ಆಡಳಿತ')
            if fixed_temp != temp_filename:
                canonical_title = get_dictionary_title(fixed_temp, None)
        
        if canonical_title:
            # Use canonical title for filename (replace spaces with underscores)
            filename = canonical_title.replace('|', '_').replace('/', '_').replace(' ', '_')
        else:
            # Fallback to dict_name if no mapping found
            filename = dict_name.strip().replace(' ', '_')
    except ImportError:
        # Fallback if import fails
        filename = dict_name.strip().replace(' ', '_')
    
    # Sanitize for filesystem safety
    filename = filename.replace('\x00', '').replace('\r', '').replace('\n', '_')
    # Remove multiple consecutive underscores
    while '__' in filename:
        filename = filename.replace('__', '_')
    filename = filename.strip('_')
    
    return filename


def print_progress_bar(current, total, bar_length=50):
    """Print a progress bar"""
    percent = (current / total) * 100
    filled = int(bar_length * current / total)
    bar = '█' * filled + '░' * (bar_length - filled)
    print(f'\r[{bar}] {current}/{total} ({percent:.1f}%)', end='', flush=True)


def main():
    """Main function - scrape all dictionaries"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Simple dictionary scraper - all entries on one page')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    parser.add_argument('--start-from', type=int, default=0, help='Start from dictionary index (0-based)')
    parser.add_argument('--limit', type=int, help='Limit number of dictionaries to process')
    
    args = parser.parse_args()
    
    scraper = SimpleDictionaryScraper(headless=args.headless)
    
    try:
        # Navigate to page
        scraper.navigate_to_dictionary()
        
        # Get all dictionaries
        dictionaries = scraper.get_all_dictionaries()
        
        if not dictionaries:
            print("No dictionaries found!")
            return
        
        # Apply limits
        start_idx = args.start_from
        end_idx = args.limit + start_idx if args.limit else len(dictionaries)
        dictionaries = dictionaries[start_idx:end_idx]
        
        print(f"\n{'='*80}")
        print(f"PROCESSING {len(dictionaries)} DICTIONARIES")
        print(f"{'='*80}\n")
        
        success_count = 0
        fail_count = 0
        
        for i, dict_info in enumerate(dictionaries, 1):
            dict_name = dict_info['text']
            # Use proper filename - preserve full Unicode name (Mac compatible)
            filename = get_proper_filename(dict_name)
            
            # Print progress info
            print(f"\n{'='*80}")
            print(f"[{i}/{len(dictionaries)}] Processing: {dict_name[:60]}...")
            print(f"  Filename: {filename}")
            print_progress_bar(i - 1, len(dictionaries))
            print()
            
            # Scrape dictionary
            data = scraper.scrape_dictionary(dict_name)
            
            if data:
                # Save files with proper Unicode filenames
                scraper.save_to_csv(f"{filename}.csv", data)
                scraper.save_to_json(f"{filename}.json", data)
                success_count += 1
                print(f"  ✅ {len(data):,} entries saved")
            else:
                fail_count += 1
                print(f"  ❌ Failed to extract data")
            
            # Update progress bar
            print_progress_bar(i, len(dictionaries))
            
            # Small delay between dictionaries
            if i < len(dictionaries):
                time.sleep(1)
        
        # Final progress bar
        print()
        print_progress_bar(len(dictionaries), len(dictionaries))
        print()
        
        print(f"\n{'='*80}")
        print("FINAL SUMMARY")
        print(f"{'='*80}")
        print(f"✅ Success: {success_count}")
        print(f"❌ Failed: {fail_count}")
        print(f"Total: {len(dictionaries)}")
        print(f"{'='*80}")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        scraper.logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        scraper.close()


if __name__ == "__main__":
    main()

