#!/usr/bin/env python3
"""
Scraper for Padakanaja Karnataka Government Dictionary
Scrapes English to Kannada dictionary entries from padakanaja.karnataka.gov.in
"""

import time
import json
import csv
import argparse
import multiprocessing
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
try:
    from webdriver_manager.chrome import ChromeDriverManager
    from selenium.webdriver.chrome.service import Service as ChromeService
    WEBDRIVER_MANAGER_AVAILABLE = True
except ImportError:
    WEBDRIVER_MANAGER_AVAILABLE = False
import logging


class DictionaryScraper:
    def __init__(self, headless=False, process_id=None):
        """Initialize the scraper with Chrome driver"""
        # Setup process-specific logger
        self.process_id = process_id
        if process_id:
            logger_name = f"scraper_{process_id}"
        else:
            logger_name = __name__
        
        self.logger = logging.getLogger(logger_name)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(f'[PID {os.getpid()}] %(asctime)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
        
        chrome_options = Options()
        if headless:
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # Use webdriver-manager if available, otherwise use system chromedriver
        if WEBDRIVER_MANAGER_AVAILABLE:
            service = ChromeService(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
        else:
            self.driver = webdriver.Chrome(options=chrome_options)
        
        self.wait = WebDriverWait(self.driver, 20)
        self.base_url = "https://padakanaja.karnataka.gov.in/dictionary"
        self.scraped_data = []
        
    def navigate_to_dictionary(self):
        """Navigate to the dictionary page"""
        self.logger.info(f"Navigating to {self.base_url}")
        self.driver.get(self.base_url)
        time.sleep(3)  # Wait for page to load
        
    def select_dictionary(self, dictionary_name=None):
        """
        Select a dictionary from the dropdown
        
        Args:
            dictionary_name: Name of the dictionary to select. If None, selects the first English-Kannada dictionary.
                            Default: "ಅರಣ್ಯಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ"
        """
        self.logger.info("Finding dictionary dropdown...")
        dropdown = None
        
        # Try multiple methods to find the dropdown
        selectors = [
            (By.ID, "dictionary-select"),
            (By.NAME, "dictionary"),
            (By.CLASS_NAME, "dictionary-select"),
            (By.XPATH, "//select[contains(@class, 'form-control')]"),
            (By.XPATH, "//select[contains(@id, 'dict')]"),
            (By.XPATH, "//select[contains(@name, 'dict')]"),
        ]
        
        for by, value in selectors:
            try:
                dropdown = self.driver.find_element(by, value)
                if dropdown:
                    self.logger.info(f"Found dropdown using {by}={value}")
                    break
            except:
                continue
        
        # If still not found, find by number of options
        if not dropdown:
            self.logger.info("Trying to find dropdown by number of options...")
            try:
                dropdowns = self.driver.find_elements(By.TAG_NAME, "select")
                for dd in dropdowns:
                    options = dd.find_elements(By.TAG_NAME, "option")
                    # Dictionary dropdown should have many options (50+)
                    if len(options) > 50:
                        dropdown = dd
                        self.logger.info(f"Found dropdown with {len(options)} options")
                        break
            except Exception as e:
                self.logger.warning(f"Error finding dropdown: {e}")
        
        if not dropdown:
            raise Exception("Could not find dictionary dropdown")
        
        # Scroll dropdown into view
        self.driver.execute_script("arguments[0].scrollIntoView(true);", dropdown)
        time.sleep(1)
        
        select = Select(dropdown)
        
        if dictionary_name:
            # Select by visible text
            self.logger.info(f"Selecting dictionary: {dictionary_name}")
            try:
                select.select_by_visible_text(dictionary_name)
            except:
                # Try by partial match
                for option in select.options:
                    if dictionary_name in option.text:
                        option.click()
                        break
        else:
            # Select the Forestry dictionary (English-Kannada)
            target_text = "ಅರಣ್ಯಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ"
            self.logger.info(f"Selecting default dictionary: {target_text}")
            try:
                select.select_by_visible_text(target_text)
            except:
                # Try selecting by partial text
                for option in select.options:
                    if "ಅರಣ್ಯಶಾಸ್ತ್ರ" in option.text and "ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ" in option.text:
                        option.click()
                        break
        
        time.sleep(3)  # Wait for dictionary to load
        self.logger.info("Dictionary selected successfully")
    
    def set_pagination(self, entries_per_page=200):
        """Set the number of entries per page"""
        try:
            self.logger.info(f"Setting pagination to {entries_per_page} entries per page...")
            
            pagination_select = None
            
            # Method 1: Find by DataTables length selector (most common)
            selectors = [
                (By.XPATH, "//select[@name='dictionary-table_length']"),
                (By.XPATH, "//select[contains(@name, 'length')]"),
                (By.XPATH, "//select[contains(@class, 'length')]"),
                (By.XPATH, "//select[contains(@id, 'length')]"),
            ]
            
            for by, value in selectors:
                try:
                    pagination_select = self.driver.find_element(by, value)
                    if pagination_select:
                        self.logger.info(f"Found pagination dropdown using {by}={value}")
                        break
                except:
                    continue
            
            # Method 2: Find select with pagination options (10, 25, 50, 100, 200)
            if not pagination_select:
                selects = self.driver.find_elements(By.TAG_NAME, "select")
                for sel in selects:
                    options = sel.find_elements(By.TAG_NAME, "option")
                    if len(options) >= 3 and len(options) <= 10:  # Pagination usually has 3-10 options
                        option_texts = [opt.text.strip() for opt in options]
                        # Check if it has common pagination values
                        if any(val in ' '.join(option_texts) for val in ['10', '25', '50', '100', '200']):
                            pagination_select = sel
                            self.logger.info(f"Found pagination dropdown with options: {option_texts}")
                            break
            
            # Method 3: Find select near "entries" or "entry" text
            if not pagination_select:
                try:
                    # Find element containing "entries" text and look for nearby select
                    entries_elements = self.driver.find_elements(
                        By.XPATH, 
                        "//*[contains(text(), 'entries') or contains(text(), 'entry')]"
                    )
                    for elem in entries_elements:
                        # Look for select in parent or sibling
                        try:
                            parent = elem.find_element(By.XPATH, "./..")
                            nearby_selects = parent.find_elements(By.TAG_NAME, "select")
                            if nearby_selects:
                                pagination_select = nearby_selects[0]
                                break
                        except:
                            continue
                except:
                    pass
            
            if pagination_select:
                self.driver.execute_script("arguments[0].scrollIntoView(true);", pagination_select)
                time.sleep(1)
                select = Select(pagination_select)
                try:
                    select.select_by_value(str(entries_per_page))
                except:
                    try:
                        select.select_by_visible_text(str(entries_per_page))
                    except:
                        # Try to find option containing the number
                        for option in select.options:
                            if str(entries_per_page) in option.text:
                                option.click()
                                break
                time.sleep(3)  # Wait for table to reload
                self.logger.info(f"Pagination set to {entries_per_page} entries")
            else:
                self.logger.warning("Could not find pagination dropdown, continuing with default")
                
        except Exception as e:
            self.logger.warning(f"Error setting pagination: {e}")
    
    def extract_table_data(self, save_after_each_page=False, output_prefix=None):
        """Extract all data from the dictionary table"""
        self.logger.info("=" * 80)
        self.logger.info("EXTRACTING TABLE DATA")
        self.logger.info("=" * 80)
        
        try:
            # Wait for table to be present and loaded
            self.logger.info("Waiting for table #myTable10 to load...")
            time.sleep(5)  # Give table more time to load after pagination change
            
            # Wait for DataTables to initialize on the specific table
            try:
                self.wait.until(
                    lambda driver: driver.execute_script("return jQuery && jQuery.fn.dataTable && jQuery.fn.dataTable.isDataTable('#myTable10');")
                )
                self.logger.info("DataTables detected for #myTable10")
            except:
                self.logger.warning("DataTables not detected for #myTable10, will try DOM method")
            
            # Try to extract using DataTables API - navigate pages properly
            try:
                self.logger.info("Attempting to extract data using DataTables API for #myTable10...")
                
                # First, get headers
                headers_script = """
                    var headers = [];
                    jQuery('#myTable10 thead th').each(function() {
                        var text = jQuery(this).text().trim();
                        text = text.replace(/\\s+/g, ' ').trim();
                        headers.push(text);
                    });
                    return headers;
                """
                headers = self.driver.execute_script(headers_script)
                self.logger.info(f"Found {len(headers)} headers")
                
                # Now extract data page by page using DOM method with proper pagination
                all_data = []
                page_num = 0
                seen_entries = set()  # Track entries to avoid duplicates
                
                while True:
                    self.logger.info("")
                    self.logger.info("=" * 60)
                    self.logger.info(f"📄 PAGE {page_num + 1} - Starting extraction...")
                    self.logger.info("=" * 60)
                    
                    # Wait for table to be ready
                    time.sleep(1)
                    
                    # Get current page data - improved to handle multi-line cells properly
                    page_data_script = """
                        var pageData = [];
                        var rows = jQuery('#myTable10 tbody tr');
                        rows.each(function() {
                            var $row = jQuery(this);
                            // Check if this is a valid data row (has td cells)
                            var cells = $row.find('td');
                            if (cells.length === 0) return; // Skip if no cells
                            
                            var row = {};
                            cells.each(function(index) {
                                var $cell = jQuery(this);
                                // Get text content - use text() which handles nested elements
                                var cellText = $cell.text().trim();
                                // Replace multiple whitespace/newlines with single space, but preserve structure
                                cellText = cellText.replace(/[\\s\\n\\r]+/g, ' ').trim();
                                row['cell_' + index] = cellText;
                            });
                            
                            // Create a unique key from the row data (use first few meaningful cells)
                            var rowKey = '';
                            cells.slice(0, 3).each(function() {
                                var text = jQuery(this).text().trim().substring(0, 50);
                                if (text) rowKey += text + '|';
                            });
                            row['_rowKey'] = rowKey;
                            
                            // Only add if row has some content
                            if (rowKey || cells.length > 0) {
                                pageData.push(row);
                            }
                        });
                        return pageData;
                    """
                    page_data = self.driver.execute_script(page_data_script)
                    
                    if not page_data:
                        self.logger.info("No more data found")
                        break
                    
                    # Process page data and add unique entries
                    page_entries = []
                    for row_dict in page_data:
                        row_key = row_dict.get('_rowKey', '')
                        # Skip empty rows
                        if not row_key or row_key.strip() == '|' or row_key.strip() == '':
                            continue
                        
                        if row_key not in seen_entries:
                            seen_entries.add(row_key)
                            # Convert to proper format with headers
                            entry = {}
                            for i, header in enumerate(headers):
                                cell_key = f'cell_{i}'
                                cell_value = row_dict.get(cell_key, '').strip()
                                # Clean up the value
                                if cell_value:
                                    # Remove excessive whitespace
                                    cell_value = ' '.join(cell_value.split())
                                entry[header] = cell_value
                            
                            # Only add if entry has at least one non-empty field
                            if any(v for v in entry.values() if v):
                                page_entries.append(entry)
                    
                    if not page_entries:
                        self.logger.info("No new entries on this page (possibly duplicates), stopping")
                        break
                    
                    all_data.extend(page_entries)
                    self.logger.info(f"✓ PAGE {page_num + 1} COMPLETE: Extracted {len(page_entries)} entries")
                    self.logger.info(f"  📊 TOTAL SO FAR: {len(all_data)} entries")
                    
                    # Save after each page if requested
                    if save_after_each_page and output_prefix:
                        self.scraped_data = all_data
                        try:
                            self.save_to_json(f"{output_prefix}_temp.json")
                            self.save_to_csv(f"{output_prefix}_temp.csv")
                            self.logger.info(f"  💾 Saved progress to {output_prefix}_temp.json/csv")
                        except Exception as e:
                            self.logger.warning(f"  ⚠️  Could not save progress: {e}")
                    
                    # Check if there's a next page - get full page info
                    page_info = self.driver.execute_script("""
                        var table = jQuery('#myTable10').DataTable();
                        if (table) {
                            var info = table.page.info();
                            return {
                                currentPage: info.page,
                                totalPages: info.pages,
                                recordsTotal: info.recordsTotal,
                                recordsDisplay: info.recordsDisplay,
                                hasNext: info.page < info.pages - 1
                            };
                        }
                        return null;
                    """)
                    
                    if page_info:
                        self.logger.info(f"📈 PAGE INFO:")
                        self.logger.info(f"   Current: {page_info['currentPage'] + 1}/{page_info['totalPages']}")
                        self.logger.info(f"   Total records in DB: {page_info['recordsTotal']}")
                        self.logger.info(f"   Extracted so far: {len(all_data)}")
                        self.logger.info(f"   Remaining: {page_info['recordsTotal'] - len(all_data)}")
                        self.logger.info(f"   Has next page: {page_info['hasNext']}")
                        
                        # Verify we haven't extracted all records yet
                        if len(all_data) >= page_info['recordsTotal']:
                            self.logger.info(f"✓ Extracted all {page_info['recordsTotal']} records")
                            break
                        
                        # CRITICAL FIX: Always check if we have fewer entries than expected
                        # Even if DataTables says no next page, try to continue if we're incomplete
                        if len(all_data) < page_info['recordsTotal']:
                            # We haven't extracted all records yet - force continue
                            self.logger.info(f"📊 Progress: {len(all_data)}/{page_info['recordsTotal']} - Continuing...")
                            
                            if not page_info['hasNext']:
                                self.logger.warning(f"⚠️  DataTables says no next page, but we're missing {page_info['recordsTotal'] - len(all_data)} entries!")
                                self.logger.warning("   Attempting to force next page by clicking button...")
                                
                                # Try multiple methods to get to next page
                                next_clicked = False
                                
                                # Method 1: Try clicking next button directly (even if disabled)
                                try:
                                    next_btn = self.driver.find_element(By.XPATH, "//a[contains(@class, 'paginate_button') and contains(@class, 'next')]")
                                    if next_btn:
                                        # Check if it's actually disabled
                                        classes = next_btn.get_attribute("class") or ""
                                        if "disabled" not in classes:
                                            next_btn.click()
                                            next_clicked = True
                                            self.logger.info("   ✓ Clicked next button")
                                        else:
                                            # Force click even if disabled
                                            self.driver.execute_script("arguments[0].click();", next_btn)
                                            next_clicked = True
                                            self.logger.info("   ✓ Force-clicked next button (was marked disabled)")
                                except Exception as e:
                                    self.logger.warning(f"   Could not click next button: {e}")
                                
                                # Method 2: Try DataTables API to go to next page number directly
                                if not next_clicked:
                                    try:
                                        current_page = page_info['currentPage']
                                        next_page = current_page + 1
                                        success = self.driver.execute_script(f"""
                                            var table = jQuery('#myTable10').DataTable();
                                            if (table) {{
                                                var info = table.page.info();
                                                if (next_page < info.pages) {{
                                                    table.page(next_page).draw('page');
                                                    return true;
                                                }}
                                            }}
                                            return false;
                                        """.replace('next_page', str(next_page)))
                                        if success:
                                            next_clicked = True
                                            self.logger.info(f"   ✓ Navigated to page {next_page + 1} via API")
                                    except Exception as e:
                                        self.logger.warning(f"   Could not navigate via API: {e}")
                                
                                if next_clicked:
                                    time.sleep(3)  # Wait for page to load
                                    page_num += 1
                                    continue
                                else:
                                    self.logger.error("   ✗ Could not advance to next page - stopping")
                                    break
                        
                        # Normal case: DataTables says there's a next page
                        if not page_info['hasNext']:
                            # But we've extracted all records, so we're done
                            if len(all_data) >= page_info['recordsTotal']:
                                self.logger.info("Reached last page and extracted all records")
                                break
                            else:
                                # This shouldn't happen, but if it does, try to continue
                                self.logger.warning("DataTables says no next page but we're incomplete - trying to continue anyway")
                                # Fall through to next page navigation code below
                        
                        # Go to next page - CRITICAL FIX: Always try if we're incomplete
                        # This fixes the page 39 issue where DataTables incorrectly reports no next page
                        must_continue = len(all_data) < page_info['recordsTotal']
                        
                        if page_info['hasNext'] or must_continue:
                            # Method 1: Try DataTables API
                            next_success = self.driver.execute_script("""
                                var table = jQuery('#myTable10').DataTable();
                                if (table) {
                                    var info = table.page.info();
                                    if (info.page < info.pages - 1) {
                                        table.page('next').draw('page');
                                        return true;
                                    }
                                }
                                return false;
                            """)
                            
                            if not next_success and must_continue:
                                # We're incomplete but API failed - try direct page navigation
                                self.logger.warning("DataTables API failed, trying direct page navigation...")
                                current_page = page_info['currentPage']
                                next_page_num = current_page + 1
                                next_success = self.driver.execute_script(f"""
                                    var table = jQuery('#myTable10').DataTable();
                                    if (table) {{
                                        table.page({next_page_num}).draw('page');
                                        return true;
                                    }}
                                    return false;
                                """)
                                if next_success:
                                    self.logger.info(f"✓ Navigated directly to page {next_page_num + 1}")
                            
                            if not next_success:
                                self.logger.warning("Could not navigate via DataTables API, trying button click...")
                                # Method 2: Try clicking next button (even if disabled if we're incomplete)
                                try:
                                    next_button = self.driver.find_element(
                                        By.XPATH,
                                        "//a[contains(@class, 'paginate_button') and contains(@class, 'next')]"
                                    )
                                    classes = next_button.get_attribute("class") or ""
                                    
                                    if "disabled" not in classes:
                                        next_button.click()
                                        self.logger.info("✓ Clicked next button")
                                    elif must_continue:
                                        # Force click even if disabled - we're incomplete!
                                        self.driver.execute_script("arguments[0].click();", next_button)
                                        self.logger.warning("⚠️  Force-clicked next button (was disabled but we're incomplete)")
                                    else:
                                        self.logger.info("Next button disabled and we have all records")
                                        break
                                except Exception as e:
                                    if must_continue:
                                        self.logger.error(f"⚠️  Could not find/click next button but we're incomplete: {e}")
                                        # Last resort: try to get page count and navigate directly
                                        try:
                                            total_pages = page_info['totalPages']
                                            current = page_info['currentPage']
                                            if current + 1 < total_pages:
                                                self.driver.execute_script(f"""
                                                    var table = jQuery('#myTable10').DataTable();
                                                    if (table) table.page({current + 1}).draw('page');
                                                """)
                                                self.logger.warning(f"⚠️  Last resort: Navigated to page {current + 2}")
                                            else:
                                                self.logger.error("⚠️  Cannot continue - no more pages available")
                                                break
                                        except:
                                            self.logger.error("⚠️  All navigation methods failed - stopping")
                                            break
                                    else:
                                        self.logger.warning(f"Could not find or click next button: {e}")
                                        break
                            
                            if next_success or must_continue:
                                time.sleep(2)  # Wait for page to load
                                page_num += 1
                                continue
                        else:
                            # We have all records and no next page - we're done
                            self.logger.info("✓ Extracted all records and reached last page")
                            break
                    else:
                        self.logger.warning("Could not get page info from DataTables, trying alternative pagination")
                        # Fallback: try to find and click next button
                        try:
                            next_button = self.driver.find_element(
                                By.XPATH,
                                "//a[contains(@class, 'paginate_button') and contains(@class, 'next') and not(contains(@class, 'disabled'))]"
                            )
                            next_button.click()
                            time.sleep(2)
                            self.logger.info("Navigated to next page via button click (fallback)")
                        except:
                            self.logger.info("No next page button found, assuming last page")
                            break
                    
                    page_num += 1
                    # Wait for page to load
                    time.sleep(2)
                
                if all_data:
                    self.logger.info(f"Successfully extracted {len(all_data)} unique entries")
                    self.scraped_data = all_data
                    return all_data
                else:
                    self.logger.warning("No data extracted")
                    data = {'success': False, 'error': 'No data extracted'}
                
                # Data extraction is done above, just continue to DOM fallback if needed
                if all_data:
                    return all_data
            except Exception as e:
                self.logger.warning(f"DataTables API method failed: {e}, falling back to DOM method")
                import traceback
                traceback.print_exc()
            
            # Fallback: Use DOM method with specific table ID
            self.logger.info("Using DOM method to extract from #myTable10...")
            table = self.wait.until(
                EC.presence_of_element_located((By.ID, "myTable10"))
            )
            
            # Scroll table into view
            self.driver.execute_script("arguments[0].scrollIntoView(true);", table)
            time.sleep(2)
            
            # Get table headers from thead
            headers = []
            try:
                thead = table.find_element(By.TAG_NAME, "thead")
                header_cells = thead.find_elements(By.TAG_NAME, "th")
                if header_cells:
                    headers = [cell.text.strip().replace('\n', ' ').replace('  ', ' ') for cell in header_cells]
                    self.logger.info(f"Found {len(headers)} headers from thead")
                    self.logger.info(f"Sample headers: {headers[:3]}")
            except Exception as e:
                self.logger.warning(f"Could not get headers from thead: {e}")
                # Default headers based on the structure provided
                headers = [
                    "ಕನ್ನಡ ಪದ (Kannada Word)",
                    "ಇಂಗ್ಲೀಷ್ ಪದ (English Word)",
                    "ಕನ್ನಡ ಅರ್ಥ (Kannada Meaning)",
                    "ಪರ್ಯಾಯ ಪದ (Synonyms)",
                    "ವಿಷಯ ವರ್ಗೀಕರಣ (Subject)",
                    "ವ್ಯಾಕರಣ ವಿಶೇಷ (Grammer)",
                    "ಇಲಾಖೆ (Department)",
                    "ಕನ್ನಡ ಉಚ್ಚಾರಣೆ (Kannada Pronunciation)",
                    "ಇಂಗ್ಲೀಷ್ ಅರ್ಥ (English Meaning)",
                    "ಸಂಕ್ಷಿಪ್ತ ವಿವರಣೆ (Short Description)",
                    "ದೀರ್ಘ ವಿವರಣೆ (Long Description)",
                    "ಆಡಳಿತಾತ್ಮಕ ಪದ (Administrative Word)"
                ]
            
            # If still no headers, try to get from DataTables API
            if not headers:
                try:
                    headers_js = self.driver.execute_script("""
                        var table = $('table').DataTable();
                        if (table) {
                            return table.columns().header().to$().map(function() {
                                return $(this).text().trim();
                            }).get();
                        }
                        return [];
                    """)
                    if headers_js:
                        headers = headers_js
                        self.logger.info(f"Found headers from DataTables API: {headers}")
                except:
                    pass
            
            # If still no headers, try to infer from first data row
            if not headers:
                try:
                    tbody = table.find_element(By.TAG_NAME, "tbody")
                    first_data_row = tbody.find_element(By.XPATH, ".//tr[1]")
                    num_cols = len(first_data_row.find_elements(By.TAG_NAME, "td"))
                    headers = [f"Column_{i+1}" for i in range(num_cols)]
                    self.logger.info(f"Using inferred headers: {headers}")
                except:
                    headers = ["English", "Kannada", "Details"]
                    self.logger.info(f"Using default headers: {headers}")
            
            # Extract all rows
            all_data = []
            page_num = 1
            max_pages = 1000  # Safety limit
            
            while page_num <= max_pages:
                self.logger.info(f"Extracting data from page {page_num}...")
                
                # Wait a bit for table to update
                time.sleep(2)
                
                # Refresh table reference
                table = self.driver.find_element(By.TAG_NAME, "table")
                
                # Get current page rows from tbody
                rows = []
                try:
                    tbody = table.find_element(By.TAG_NAME, "tbody")
                    rows = tbody.find_elements(By.TAG_NAME, "tr")
                    self.logger.info(f"Found {len(rows)} rows in tbody on page {page_num}")
                except Exception as e:
                    self.logger.warning(f"Could not find tbody: {e}")
                    break
                
                if not rows:
                    self.logger.warning("No rows found on this page")
                    break
                
                page_data = []
                for idx, row in enumerate(rows):
                    try:
                        # Handle both WebElement and DOM node from DataTables
                        if hasattr(row, 'find_elements'):
                            # It's a WebElement
                            cells = row.find_elements(By.TAG_NAME, "td")
                        else:
                            # It's a DOM node from DataTables, convert to WebElement
                            row = self.driver.execute_script("return arguments[0];", row)
                            cells = row.find_elements(By.TAG_NAME, "td")
                        
                        if cells and len(cells) > 0:
                            row_data = {}
                            for i, cell in enumerate(cells):
                                header = headers[i] if i < len(headers) else f"Column_{i+1}"
                                cell_text = cell.text.strip()
                                row_data[header] = cell_text
                            
                            # Only add if row has meaningful data (not just empty strings)
                            if any(v for v in row_data.values() if v):
                                page_data.append(row_data)
                    except Exception as e:
                        self.logger.warning(f"Error processing row {idx}: {e}")
                        continue
                
                if not page_data:
                    self.logger.info("No data found on this page, stopping")
                    break
                
                all_data.extend(page_data)
                self.logger.info(f"Extracted {len(page_data)} entries from page {page_num} (Total: {len(all_data)})")
                
                # Try to go to next page
                try:
                    # Look for next button (DataTables style)
                    next_buttons = self.driver.find_elements(
                        By.XPATH, 
                        "//a[contains(@class, 'paginate_button') and contains(@class, 'next')]"
                    )
                    
                    if not next_buttons:
                        # Try other common patterns
                        next_buttons = self.driver.find_elements(
                            By.XPATH,
                            "//a[contains(text(), 'Next') or contains(text(), 'next')]"
                        )
                    
                    if next_buttons:
                        next_button = next_buttons[0]
                        classes = next_button.get_attribute("class") or ""
                        if "disabled" in classes:
                            self.logger.info("Reached last page")
                            break
                        next_button.click()
                        time.sleep(2)  # Wait for next page to load
                        page_num += 1
                    else:
                        self.logger.info("No next button found, assuming last page")
                        break
                except Exception as e:
                    self.logger.info(f"Could not navigate to next page: {e}")
                    break
            
            self.scraped_data = all_data
            self.logger.info(f"Total entries extracted: {len(all_data)}")
            return all_data
            
        except Exception as e:
            self.logger.error(f"Error extracting table data: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def save_to_json(self, filename="dictionary_data.json"):
        """Save scraped data to JSON file"""
        self.logger.info(f"Saving {len(self.scraped_data)} entries to {filename}...")
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.scraped_data, f, ensure_ascii=False, indent=2)
        self.logger.info(f"Data saved to {filename}")
    
    def save_to_csv(self, filename="dictionary_data.csv"):
        """Save scraped data to CSV file"""
        if not self.scraped_data:
            self.logger.warning("No data to save")
            return
        
        self.logger.info(f"Saving {len(self.scraped_data)} entries to {filename}...")
        
        # Get all unique keys from all entries
        all_keys = set()
        for entry in self.scraped_data:
            all_keys.update(entry.keys())
        fieldnames = sorted(list(all_keys))
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(self.scraped_data)
        
        self.logger.info(f"Data saved to {filename}")
    
    def get_all_english_kannada_dictionaries(self):
        """Get list of all English-Kannada dictionaries from dropdown"""
        try:
            self.logger.info("Finding dictionary dropdown to get all English-Kannada dictionaries...")
            dropdown = None
            
            # Try to find the dropdown (same logic as select_dictionary)
            selectors = [
                (By.ID, "dictionary-select"),
                (By.NAME, "dictionary"),
                (By.CLASS_NAME, "dictionary-select"),
                (By.XPATH, "//select[contains(@class, 'form-control')]"),
            ]
            
            for by, value in selectors:
                try:
                    dropdown = self.driver.find_element(by, value)
                    if dropdown:
                        break
                except:
                    continue
            
            if not dropdown:
                # Find by number of options
                dropdowns = self.driver.find_elements(By.TAG_NAME, "select")
                for dd in dropdowns:
                    options = dd.find_elements(By.TAG_NAME, "option")
                    if len(options) > 50:
                        dropdown = dd
                        break
            
            if not dropdown:
                raise Exception("Could not find dictionary dropdown")
            
            select = Select(dropdown)
            
            english_kannada_dicts = []
            for option in select.options:
                text = option.text.strip()
                # Look for English-Kannada indicators
                if ("ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ" in text or 
                    "English-Kannada" in text or 
                    "English - Kannada" in text or
                    "English–Kannada" in text or
                    ("English" in text and "Kannada" in text and "ಕನ್ನಡ" not in text.split("English")[0])):
                    english_kannada_dicts.append({
                        'text': text,
                        'value': option.get_attribute('value')
                    })
            
            self.logger.info(f"Found {len(english_kannada_dicts)} English-Kannada dictionaries")
            return english_kannada_dicts
        except Exception as e:
            self.logger.error(f"Error getting dictionary list: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def scrape_all_english_kannada_dictionaries(self):
        """Scrape all English-Kannada dictionaries"""
        dicts = self.get_all_english_kannada_dictionaries()
        self.logger.info(f"Found {len(dicts)} English-Kannada dictionaries")
        
        all_results = {}
        for i, dict_info in enumerate(dicts, 1):
            self.logger.info(f"\n[{i}/{len(dicts)}] Scraping: {dict_info['text']}")
            try:
                self.select_dictionary(dict_info['text'])
                self.set_pagination(200)
                data = self.extract_table_data()
                
                # Clean dictionary name for filename
                safe_name = "".join(c for c in dict_info['text'][:50] if c.isalnum() or c in (' ', '-', '_')).strip()
                safe_name = safe_name.replace(' ', '_')
                
                all_results[safe_name] = data
                
                # Save individual dictionary
                self.scraped_data = data
                self.save_to_json(f"dictionary_{safe_name}.json")
                self.save_to_csv(f"dictionary_{safe_name}.csv")
                
            except Exception as e:
                self.logger.error(f"Error scraping {dict_info['text']}: {e}")
                continue
        
        # Save combined results
        with open("all_dictionaries_combined.json", 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"\nScraping complete! Processed {len(all_results)} dictionaries")
        return all_results
    
    def close(self):
        """Close the browser"""
        self.driver.quit()
        self.logger.info("Browser closed")


def scrape_single_dictionary(dictionary_name=None, headless=False, output_prefix=None, save_progress=False):
    """Scrape a single dictionary"""
    scraper = DictionaryScraper(headless=headless)
    
    try:
        scraper.navigate_to_dictionary()
        
        if dictionary_name:
            scraper.select_dictionary(dictionary_name)
        else:
            # Default: Forestry dictionary
            scraper.select_dictionary()
            dictionary_name = "ಅರಣ್ಯಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ"
        
        scraper.set_pagination(200)
        
        # Generate safe filename
        if output_prefix:
            safe_name = output_prefix
        else:
            safe_name = "".join(c for c in dictionary_name[:50] if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_').replace('|', '_').replace('/', '_')
        
        # Extract with progress saving
        scraper.extract_table_data(save_after_each_page=True, output_prefix=safe_name)
        
        # Final save
        scraper.save_to_json(f"{safe_name}.json")
        scraper.save_to_csv(f"{safe_name}.csv")
        
        # Clean up temp files if they exist
        try:
            if os.path.exists(f"{safe_name}_temp.json"):
                os.remove(f"{safe_name}_temp.json")
            if os.path.exists(f"{safe_name}_temp.csv"):
                os.remove(f"{safe_name}_temp.csv")
        except:
            pass
        
        scraper.logger.info(f"✓ Successfully scraped dictionary: {dictionary_name}")
        return True
        
    except Exception as e:
        scraper.logger.error(f"Error scraping dictionary: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        scraper.close()


def get_all_dictionaries():
    """Get list of all English-Kannada dictionaries (quick method without full scraping)"""
    scraper = DictionaryScraper(headless=True)
    try:
        scraper.navigate_to_dictionary()
        dicts = scraper.get_all_english_kannada_dictionaries()
        return dicts
    finally:
        scraper.close()


def main():
    """Main function to run the scraper"""
    parser = argparse.ArgumentParser(description='Scrape Padakanaja Dictionary')
    parser.add_argument('--dictionary', '-d', type=str, help='Dictionary name to scrape (exact text from dropdown)')
    parser.add_argument('--list', '-l', action='store_true', help='List all available English-Kannada dictionaries')
    parser.add_argument('--headless', action='store_true', help='Run in headless mode (no browser window)')
    parser.add_argument('--output', '-o', type=str, help='Output filename prefix (without extension)')
    
    args = parser.parse_args()
    
    if args.list:
        print("Fetching list of English-Kannada dictionaries...")
        dicts = get_all_dictionaries()
        print(f"\nFound {len(dicts)} English-Kannada dictionaries:\n")
        for i, d in enumerate(dicts, 1):
            print(f"{i}. {d['text']}")
        return
    
    # Scrape the specified dictionary
    success = scrape_single_dictionary(
        dictionary_name=args.dictionary,
        headless=args.headless,
        output_prefix=args.output
    )
    
    if not success:
        exit(1)


if __name__ == "__main__":
    main()

