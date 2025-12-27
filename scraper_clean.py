#!/usr/bin/env python3
"""
Clean, simple dictionary scraper - one dictionary at a time
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


class DictionaryScraper:
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
        
        # Set window size to 1/8 of screen (assuming 1920x1080, so ~240x135)
        # Using 480x540 for better usability (1/4 width, 1/2 height)
        chrome_options.add_argument('--window-size=480,540')
        
        # Initialize driver
        if WEBDRIVER_MANAGER_AVAILABLE:
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
        else:
            self.driver = webdriver.Chrome(options=chrome_options)
        
        # Position window (macOS specific, adjust for other OS)
        self.driver.set_window_position(0, 0)
        
        self.wait = WebDriverWait(self.driver, 20)
        self.base_url = "https://padakanaja.karnataka.gov.in/dictionary"
        self.scraped_data = []
        
        self.logger.info("=" * 80)
        self.logger.info("SCRAPER INITIALIZED")
        self.logger.info("=" * 80)
    
    def navigate_to_dictionary(self):
        """Navigate to dictionary page"""
        self.logger.info(f"Navigating to: {self.base_url}")
        self.driver.get(self.base_url)
        time.sleep(2)
        self.logger.info("✓ Page loaded")
    
    def select_dictionary(self, dictionary_name):
        """Select dictionary from dropdown"""
        self.logger.info("=" * 80)
        self.logger.info(f"SELECTING DICTIONARY: {dictionary_name}")
        self.logger.info("=" * 80)
        
        try:
            # Find dropdown
            dropdown = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//select[contains(@class, 'form-control')]"))
            )
            self.logger.info("✓ Found dictionary dropdown")
            
            # Select dictionary
            select = Select(dropdown)
            select.select_by_visible_text(dictionary_name)
            self.logger.info("✓ Dictionary selected")
            
            # Wait for table to load
            time.sleep(3)
            self.logger.info("✓ Waiting for table to load...")
            
            return True
        except Exception as e:
            self.logger.error(f"✗ Error selecting dictionary: {e}")
            return False
    
    def set_pagination(self, entries_per_page=200):
        """Set entries per page"""
        self.logger.info(f"Setting pagination to {entries_per_page} entries per page...")
        
        try:
            pagination_dropdown = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//select[contains(@name, 'length')]"))
            )
            select = Select(pagination_dropdown)
            select.select_by_value(str(entries_per_page))
            self.logger.info(f"✓ Pagination set to {entries_per_page}")
            
            # Wait for table to reload
            time.sleep(3)
            return True
        except Exception as e:
            self.logger.error(f"✗ Error setting pagination: {e}")
            return False
    
    def get_table_info(self):
        """Get table information (total records, current page, total pages)"""
        try:
            info = self.driver.execute_script("""
                var table = jQuery('#myTable10').DataTable();
                if (table) {
                    var pageInfo = table.page.info();
                    return {
                        recordsTotal: pageInfo.recordsTotal,
                        recordsDisplay: pageInfo.recordsDisplay,
                        currentPage: pageInfo.page,
                        totalPages: pageInfo.pages,
                        start: pageInfo.start,
                        end: pageInfo.end
                    };
                }
                return null;
            """)
            return info
        except Exception as e:
            self.logger.warning(f"Could not get table info: {e}")
            return None
    
    def extract_current_page(self):
        """Extract data from current page"""
        try:
            # Get headers
            headers = self.driver.execute_script("""
                var headers = [];
                jQuery('#myTable10 thead th').each(function() {
                    headers.push(jQuery(this).text().trim());
                });
                return headers;
            """)
            
            # Get current page data
            page_data = self.driver.execute_script("""
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
            for row_dict in page_data:
                entry = {}
                for i, header in enumerate(headers):
                    cell_key = f'cell_{i}'
                    entry[header] = row_dict.get(cell_key, '').strip()
                if any(v for v in entry.values() if v):  # Only add non-empty entries
                    entries.append(entry)
            
            return entries
        except Exception as e:
            self.logger.error(f"Error extracting page data: {e}")
            return []
    
    def click_next_button(self):
        """Click the next button using the specific selector"""
        try:
            # Try multiple selectors
            selectors = [
                (By.ID, "myTable10_next"),
                (By.XPATH, "//*[@id='myTable10_next']"),
                (By.CSS_SELECTOR, "#myTable10_next"),
                (By.XPATH, "//a[@id='myTable10_next' and contains(@class, 'paginate_button')]")
            ]
            
            for by, selector in selectors:
                try:
                    next_button = self.driver.find_element(by, selector)
                    classes = next_button.get_attribute("class") or ""
                    
                    if "disabled" in classes:
                        self.logger.info("Next button is disabled")
                        return False
                    
                    # Scroll into view and click
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", next_button)
                    time.sleep(0.5)
                    next_button.click()
                    self.logger.info("✓ Clicked next button")
                    return True
                except NoSuchElementException:
                    continue
            
            self.logger.warning("Could not find next button with any selector")
            return False
        except Exception as e:
            self.logger.error(f"Error clicking next button: {e}")
            return False
    
    def scrape_dictionary(self, dictionary_name, output_prefix=None, save_after_each_page=True):
        """Scrape entire dictionary"""
        self.logger.info("=" * 80)
        self.logger.info("STARTING SCRAPE")
        self.logger.info("=" * 80)
        self.logger.info(f"Dictionary: {dictionary_name}")
        
        # Navigate and select
        self.navigate_to_dictionary()
        if not self.select_dictionary(dictionary_name):
            return False
        
        if not self.set_pagination(200):
            return False
        
        # Get initial table info
        table_info = self.get_table_info()
        if not table_info:
            self.logger.error("Could not get table information")
            return False
        
        total_records = table_info['recordsTotal']
        total_pages = table_info['totalPages']
        
        self.logger.info("=" * 80)
        self.logger.info("TABLE INFORMATION")
        self.logger.info("=" * 80)
        self.logger.info(f"Total Records: {total_records:,}")
        self.logger.info(f"Total Pages: {total_pages}")
        self.logger.info(f"Entries per page: 200")
        self.logger.info("=" * 80)
        
        all_data = []
        current_page = 0
        
        while current_page < total_pages:
            current_page += 1
            
            self.logger.info("")
            self.logger.info("=" * 80)
            self.logger.info(f"PAGE {current_page}/{total_pages}")
            self.logger.info("=" * 80)
            
            # Get current table info
            table_info = self.get_table_info()
            if table_info:
                self.logger.info(f"Current Page (from DataTables): {table_info['currentPage'] + 1}")
                self.logger.info(f"Records on this page: {table_info['recordsDisplay']}")
            
            # Extract current page
            self.logger.info("Extracting entries from current page...")
            page_entries = self.extract_current_page()
            
            if not page_entries:
                self.logger.warning("No entries found on this page!")
                break
            
            self.logger.info(f"✓ Extracted {len(page_entries)} entries from page {current_page}")
            all_data.extend(page_entries)
            
            self.logger.info(f"📊 TOTAL ENTRIES SO FAR: {len(all_data):,}/{total_records:,}")
            self.logger.info(f"📊 PROGRESS: {(len(all_data)/total_records)*100:.1f}%")
            
            # Save progress
            if save_after_each_page and output_prefix:
                self.scraped_data = all_data
                try:
                    self.save_to_csv(f"{output_prefix}_temp.csv")
                    self.logger.info(f"💾 Saved progress to {output_prefix}_temp.csv")
                except Exception as e:
                    self.logger.warning(f"Could not save progress: {e}")
            
            # Check if we're done
            if len(all_data) >= total_records:
                self.logger.info("✓ All records extracted!")
                break
            
            # Try to go to next page
            if current_page < total_pages:
                self.logger.info("Clicking next button...")
                if not self.click_next_button():
                    self.logger.warning("Could not click next button, but we're not done yet")
                    # Try alternative method
                    try:
                        self.driver.execute_script("""
                            var table = jQuery('#myTable10').DataTable();
                            if (table) {
                                var info = table.page.info();
                                if (info.page < info.pages - 1) {
                                    table.page('next').draw('page');
                                }
                            }
                        """)
                        self.logger.info("✓ Used DataTables API to go to next page")
                    except Exception as e:
                        self.logger.error(f"Could not navigate to next page: {e}")
                        break
                
                # Wait for next page to load
                time.sleep(3)
            else:
                self.logger.info("Reached last page")
                break
        
        self.logger.info("")
        self.logger.info("=" * 80)
        self.logger.info("SCRAPING COMPLETE")
        self.logger.info("=" * 80)
        self.logger.info(f"Total entries extracted: {len(all_data):,}")
        self.logger.info(f"Expected entries: {total_records:,}")
        
        if len(all_data) == total_records:
            self.logger.info("✅ SUCCESS: All entries extracted!")
        elif len(all_data) < total_records:
            missing = total_records - len(all_data)
            self.logger.warning(f"⚠️  INCOMPLETE: Missing {missing:,} entries")
        else:
            extra = len(all_data) - total_records
            self.logger.warning(f"⚠️  EXTRA: {extra:,} more entries than expected")
        
        self.scraped_data = all_data
        return True
    
    def save_to_csv(self, filename):
        """Save data to CSV"""
        if not self.scraped_data:
            return
        
        # Get headers from first entry
        headers = list(self.scraped_data[0].keys())
        
        with open(filename, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(self.scraped_data)
        
        self.logger.info(f"✓ Saved {len(self.scraped_data)} entries to {filename}")
    
    def save_to_json(self, filename):
        """Save data to JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.scraped_data, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"✓ Saved {len(self.scraped_data)} entries to {filename}")
    
    def close(self):
        """Close browser"""
        self.driver.quit()
        self.logger.info("Browser closed")


def scrape_single_dictionary(dictionary_name, output_prefix=None, headless=False):
    """Scrape a single dictionary"""
    scraper = DictionaryScraper(headless=headless)
    
    try:
        success = scraper.scrape_dictionary(dictionary_name, output_prefix)
        
        if success and output_prefix:
            scraper.save_to_json(f"{output_prefix}.json")
            scraper.save_to_csv(f"{output_prefix}.csv")
            
            # Clean up temp files
            temp_csv = f"{output_prefix}_temp.csv"
            if os.path.exists(temp_csv):
                os.remove(temp_csv)
                scraper.logger.info(f"✓ Cleaned up {temp_csv}")
        
        return success
    except Exception as e:
        scraper.logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        scraper.close()


def main():
    """Main function with command line arguments"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Scrape Kannada dictionary')
    parser.add_argument('--dictionary', type=str, help='Dictionary name to scrape')
    parser.add_argument('--output', type=str, help='Output file prefix')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    parser.add_argument('--list', action='store_true', help='List all dictionaries')
    
    args = parser.parse_args()
    
    if args.list:
        # List all dictionaries
        scraper = DictionaryScraper(headless=True)
        try:
            scraper.navigate_to_dictionary()
            dropdown = scraper.wait.until(
                EC.presence_of_element_located((By.XPATH, "//select[contains(@class, 'form-control')]"))
            )
            select = Select(dropdown)
            options = select.options
            
            print(f"\nFound {len(options)} dictionaries:\n")
            for i, option in enumerate(options, 1):
                text = option.text.strip()
                if 'ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ' in text or 'ಕನ್ನಡ-ಇಂಗ್ಲೀಷ್' in text:
                    print(f"{i}. {text}")
        finally:
            scraper.close()
        return
    
    if not args.dictionary:
        print("Error: --dictionary is required (use --list to see available dictionaries)")
        return
    
    # Generate output prefix if not provided
    if not args.output:
        safe_name = "".join(c for c in args.dictionary[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
        args.output = safe_name.replace(' ', '_').replace('|', '_').replace('/', '_')
    
    print(f"\nScraping: {args.dictionary}")
    print(f"Output: {args.output}.json/csv\n")
    
    success = scrape_single_dictionary(args.dictionary, args.output, args.headless)
    
    if success:
        print(f"\n✅ Successfully scraped: {args.dictionary}")
    else:
        print(f"\n❌ Failed to scrape: {args.dictionary}")
        sys.exit(1)


if __name__ == "__main__":
    main()

