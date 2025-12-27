#!/usr/bin/env python3
"""
Batch process all CSV files in padakanaja/ directory and generate summary.
"""

import os
import csv
import sys
import json
from pathlib import Path
import sys
from pathlib import Path
# Add parent directory to path to import from same directory
sys.path.insert(0, str(Path(__file__).parent))
from csv_to_yaml_parser import parse_csv_to_yaml, save_yaml
from collections import defaultdict


def get_dictionary_title_mapping():
    """Get mapping of filenames to correct dictionary titles (fixing typos)."""
    # Mapping of filename stems to correct titles
    title_map = {
        'ಅರಣಯಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ': 'ಅರಣ್ಯಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಆಡಳತ_ಮತತ_ತತರಕ_ಪದಕಶ_-_ಕರನಟಕ_ವದಯತ_ಪರ': 'ಆಡಳಿತ ಮತ್ತು ತಾಂತ್ರಿಕ ಪದಕೋಶ - ಕರ್ನಾಟಕ ವಿದ್ಯಾವತಿ ಪ್ರಕಾಶನ',
        'ಆಡಳತ_ಮತತ_ತತರಕ_ಪದಕಶ_-_ಬಗಳರ_ವದಯತ_ಸರ': 'ಆಡಳಿತ ಮತ್ತು ತಾಂತ್ರಿಕ ಪದಕೋಶ - ಬೆಂಗಳೂರು ವಿದ್ಯಾವತಿ ಸರಕಾರ',
        'ಆತರಕ_ಲಕಕ_ಪರಶಧನ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕ': 'ಆರ್ಥಿಕ ಲಕ್ಷ್ಯಕ ಪರಿಶೋಧನ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ',
        'ಆರಥಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ': 'ಆರ್ಥಿಕ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ ರಾಜ್ಯ',
        'ಇ-ಆಡಳತ_ಪದರಚನ_ಸಮತಯಲಲ_ಅನಮದನಗಡ_ಪದಗಳ_ಇಗ': 'ಇ-ಆಡಳಿತ ಪದರಚನ ಸಮತೆಯಲ್ಲಿ ಅನುಮೋದನಗೊಂಡ ಪದಗಳು | ಇಂಗ್ಲೀಷ್',
        'ಇಗಲಷ-ಕನನಡ_ವಜಞನ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ': 'ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ ವಿಜ್ಞಾನ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ಇಗಲಷ_ಕನನಡ_ಔದಯಮಕ_ನಘಟ__ಇಗಲಷ-ಕನನಡ__ಪ': 'ಇಂಗ್ಲೀಷ್ ಕನ್ನಡ ಔದ್ಯೋಗಿಕ ನಿಘಂಟು | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ಇಗಲಷ_ಕನನಡ_ಪದಕಶ_-_ಭರತ_ಎಲಕಟರನಕಸ__ಇ': 'ಇಂಗ್ಲೀಷ್ ಕನ್ನಡ ಪದಕೋಶ - ಭಾರತ ಎಲೆಕ್ಟ್ರಾನಿಕ್ಸ್ | ಇಂಗ್ಲೀಷ್',
        'ಉಗರಣ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ': 'ಉಗ್ರಾಣ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ ರಾಜ್ಯ',
        'ಕಟಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ_ಇಗಲಷ-ಕನನಡ__ಪರ': 'ಕೀಟಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ಕನನ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-_ಸಸದಯ': 'ಕನ್ನಡ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಸಸ್ಯದಯ',
        'ಕನನ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ': 'ಕನ್ನಡ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ ರಾಜ್ಯ',
        'ಕನನಡ-ಇಗಲಷ_ನಘಟ_ಪದ_ಯಸಜ_ಕನನಡ_-_ಕನನಡ_ಪ': 'ಕನ್ನಡ-ಇಂಗ್ಲೀಷ್ ನಿಘಂಟು ಪದ ಯೋಜನೆ ಕನ್ನಡ - ಕನ್ನಡ ಪ್ರಕಾಶನ',
        'ಕಪಯಟರ_ತತರಜಞನ_ಪದವವರಣ_ಕಶ__ಇಗಲಷ-ಕನನಡ': 'ಕಂಪ್ಯೂಟರ್ ತಂತ್ರಜ್ಞಾನ ಪದವಿವರಣ ಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಕಮಗರ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರ': 'ಕಮಗಾರ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ ರಾಜ್ಯ',
        'ಕರಮಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರ': 'ಕರಮಿಕ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ ರಾಜ್ಯ',
        'ಕಷ_ಎಜನಯರಗ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನ': 'ಕೃಷಿ ಎಂಜಿನಿಯರಿಂಗ್ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಕಷ_ರಸಯನಶಸತರ_ಶಬದರಥ_ನರಪಣವಳ__ಇಗಲಷ-ಕ': 'ಕೃಷಿ ರಸಾಯನಶಾಸ್ತ್ರ ಶಬ್ದಾರ್ಥ ನಿರೂಪಣಾವಳಿ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಕಷ_ವಜಞನ_ತತರಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರ': 'ಕೃಷಿ ವಿಜ್ಞಾನ ತಾಂತ್ರಿಕ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ಕಷ_ವಜಞನ_ಪದಕಶ_ಕಷ_ವಜಞನ_ಗಲಸರ__ಇಗಲ': 'ಕೃಷಿ ವಿಜ್ಞಾನ ಪದಕೋಶ ಕೃಷಿ ವಿಜ್ಞಾನ ಗಳಸರ | ಇಂಗ್ಲೀಷ್',
        'ಕಷ_ವಜಞನ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ': 'ಕೃಷಿ ವಿಜ್ಞಾನ ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ಕಷ_ಸಕಷಮಜವಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲ': 'ಕೃಷಿ ಸಂಕೇತಮಜವಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್',
        'ಕಷ_ಸಸಯಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನ': 'ಕೃಷಿ ಸಸ್ಯಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಖಜನ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-_ಕನನಡ_ಮ': 'ಖಜಾನೆ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕನ್ನಡ ಮತ್ತು ಸಂಸ್ಕೃತಿ ಇಲಾಖೆ',
        'ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ': 'ಗಣಕ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ ರಾಜ್ಯ',
        'ಜವ_ಇಗಲಷ_-_ಕನನಡ_ನಘಟ__ಇಗಲಷ-ಕನನಡ__ಪ': 'ಜೀವಿ ಇಂಗ್ಲೀಷ್ - ಕನ್ನಡ ನಿಘಂಟು | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ತಟಗರಕ_ಇಲಖ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ': 'ತಟಗಾರಿಕ ಇಲಾಖೆ ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ತಟಗರಕ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರ': 'ತಟಗಾರಿಕ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ನವಕರನಟಕ_ಆಡಳಿತ_ಪದಕಶ_ಕನನಡ-ಇಗಲಷ-ಕನನಡ_ಪರಕ': 'ನೌಕರನಾಟಕ ಆಡಳಿತ ಪದಕೋಶ ಕನ್ನಡ-ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ ಪ್ರಕಾಶಕ',
        'ನವಕರನಟಕ_ಆಡಳಿತ_ಪದಕಶ_ಕನನಡ-ಇಗಲಷ-ಕನನಡ_ಪರಕ_temp': 'ನೌಕರನಾಟಕ ಆಡಳಿತ ಪದಕೋಶ ಕನ್ನಡ-ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ ಪ್ರಕಾಶಕ',
        'ಪತರಕ_ನಘಟ_-_ಎಲ_ಗಡಪಪ__ಇಗಲಷ-ಕನನಡ': 'ಪತ್ರಿಕಾ ನಿಘಂಟು - ಎಲ್ ಗಡಪಪ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಪತರಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-_ಕರನ': 'ಪತ್ರಿಕಾ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು - ಕರ್ನಾಟಕ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಅಗನಶಮಕ_ಸವಗಳ_ಇಲಖ__ಇಗಲಷ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಅಗ್ನಿಶಾಮಕ ಸೇವೆಗಳ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಆರಥಕ_ಮತತ_ಸಖಯಕ_ಇಲಖ__ಇ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಆರ್ಥಿಕ ಮತ್ತು ಸಂಖ್ಯಾಯಕ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಆಹರ_ಮತತ_ನಗರಕ_ಪರಕ_ನರದಶ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಆಹಾರ ಮತ್ತು ನಾಗರಿಕ ಪರಕ ನಿರ್ದೇಶ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಔಷಧ_ನಯತರಣ_ಇಲಖ__ಇಗಲಷ-ಕನ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಔಷಧ ನಿಯಂತ್ರಣ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಕಗರಕ_ಮತತ_ವಣಜಯ_ಇಲಖ__ಇ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಕಗಾರಕ ಮತ್ತು ವಾಣಿಜ್ಯ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಕರಗಹಗಳ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಕರಗಹಗಳ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಕರನಟಕ_ಲಕಸವ_ಆಯಗ__ಇಗಲಷ-': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಕರ್ನಾಟಕ ಲಕ್ಷ್ಯಸೇವಾ ಆಯೋಗ | ಇಂಗ್ಲೀಷ್-',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಕರಮಕ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಕರಮಿಕ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಕಷ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ__ಪ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಕೃಷಿ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಗಹರಕಷಕದಳ_ಮತತ_ಪರರಕಷಣ_ನರದ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಗಹರಕಷಕದಳ ಮತ್ತು ಪರರಕಷಣ ನಿರ್ದೇಶ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಚಲನಚತರ_ಅಭವದಧ_ನಗಮ__ಇಗಲ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಚಲನಚಿತ್ರ ಅಭಿವೃದ್ಧಿ ನಿಗಮ | ಇಂಗ್ಲೀಷ್',
        'ಪರಭಷಕ_ಪದಕಶ_-_ನದಣ_ಮತತ_ಮದರಕಗಳ_ಇಲಖ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ನದಣ ಮತ್ತು ಮದರಕಗಳ ಇಲಾಖೆ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಪತರಗರ__ಇಗಲಷ-ಕನನಡ_ಪರಕ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಪತ್ರಗಾರ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ ಪ್ರಕಾಶಕ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಪಶಸಗಪನ_ಮತತ_ಪಶವದಯ_ಇಲಖ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಪಶುಸಂಗೋಪನ ಮತ್ತು ಪಶುವೈದ್ಯ ಇಲಾಖೆ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಮದರಣ_ಲಖನಸಮಗರ_ಮತತ_ಪರಕಟಣ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಮುದ್ರಣ ಲೇಖನಸಮಗರ ಮತ್ತು ಪ್ರಕಟಣ',
        'ಪರಭಷಕ_ಪದಕಶ_-_ವಣಜಯ_ತರಗ_ಇಲಖ__ಇಗಲಷ-': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ವಾಣಿಜ್ಯ ತರಗ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್-',
        'ಪರಭಷಕ_ಪದಕಶ_-_ಸಣಣ_ಉಳತಯ_ಇಲಖ__ಇಗಲಷ-ಕನ': 'ಪಾರಿಭಾಷಿಕ ಪದಕೋಶ - ಸಣ್ಣ ಉಳಿತಾಯ ಇಲಾಖೆ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ',
        'ಪರಭಷಕ_ಪದಗಳ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ': 'ಪಾರಿಭಾಷಿಕ ಪದಗಳು - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ',
        'ಪರಸರ_ಶಖ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ': 'ಪರಸರ ಶಾಖ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ',
        'ಪಶವದಯಕಯ_ಮತತ_ಪಶಸಗಪನ_ಪರಭಷಕ_ಶಬದಕಶ__ಇ': 'ಪಶುವೈದ್ಯಕೀಯ ಮತ್ತು ಪಶುಸಂಗೋಪನ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್',
        'ಫಡಮಟಲ_ಅಡಮನಸಟರಟವ_ಟರಮನಲಜ_ಇಗಲಷ-': 'ಫೌಂಡೇಶನ್ ಅಡಮಿನಿಸ್ಟ್ರೇಟಿವ್ ಟರ್ಮಿನಾಲಜಿ | ಇಂಗ್ಲೀಷ್-',
        'ಬಸಯಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ_ಇಗಲಷ-ಕನನಡ__ಪ': 'ವ್ಯಾಪಾರಶಾಸ್ತ್ರ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ಭದರತ_ಮತತ_ಜಗತ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-': 'ಭದ್ರತ ಮತ್ತು ಜಾಗತಿಕ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ -',
        'ಮದರಣ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ': 'ಮುದ್ರಣ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ ರಾಜ್ಯ',
        'ಮನಗರಕ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ': 'ಮನಗಾರಿಕ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ವಶವವದಯಲಯ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-': 'ವಿಶ್ವವಿದ್ಯಾಲಯ ಪದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು -',
        'ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ': 'ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
        'ಸಚರ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ': 'ಸಚಿವ ವಿಭಾಗ - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ ರಾಜ್ಯ',
        'ಸಮನಯ_ಬಳಕ_ಪದಗಳ_-_ಸಕಷಪತ_ಆಡಳಿತ_ಪದಕಶ_-_ಕರನ': 'ಸಾಮಾನ್ಯ ಬಳಕೆ ಪದಗಳು - ಸಕ್ರಿಯ ಆಡಳಿತ ಪದಕೋಶ - ಕರ್ನಾಟಕ',
        'ಹನಗರಕ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ': 'ಹನಿಗಾರಿಕ ಪಾರಿಭಾಷಿಕ ಶಬ್ದಕೋಶ | ಇಂಗ್ಲೀಷ್-ಕನ್ನಡ | ಪ್ರಕಾಶಕರು',
    }
    return title_map


def get_dictionary_title(filename_stem, json_file_path=None):
    """Get correct dictionary title, fixing typos."""
    title_map = get_dictionary_title_mapping()
    
    # First check the mapping
    if filename_stem in title_map:
        return title_map[filename_stem]
    
    # Try to extract from JSON if available
    if json_file_path and Path(json_file_path).exists():
        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Check if there's a title field in the data
                if isinstance(data, list) and len(data) > 0:
                    first_entry = data[0]
                    if isinstance(first_entry, dict):
                        for key in ['title', 'dictionary', 'name', 'Title', 'Dictionary']:
                            if key in first_entry:
                                return first_entry[key]
        except:
            pass
    
    # Return None if not found - will use filename
    return None


def infer_languages(actual_columns, column_counts, total_rows):
    """Infer from/to languages based on which columns have data."""
    from_lang = 'Unknown'
    to_lang = 'Unknown'
    
    # Check which language columns have significant data
    english_word_count = column_counts.get('english_word', 0)
    kannada_word_count = column_counts.get('kannada_word', 0)
    english_meaning_count = column_counts.get('english_meaning', 0)
    kannada_meaning_count = column_counts.get('kannada_meaning', 0)
    
    # Determine direction based on which word columns have data
    if english_word_count > kannada_word_count * 0.5:
        # English words present - likely English -> Kannada
        from_lang = 'English'
        if kannada_meaning_count > total_rows * 0.1:
            to_lang = 'Kannada'
        elif kannada_word_count > total_rows * 0.1:
            to_lang = 'Kannada'
        else:
            to_lang = 'Unknown'
    elif kannada_word_count > english_word_count * 0.5:
        # Kannada words present - likely Kannada -> English
        from_lang = 'Kannada'
        if english_meaning_count > total_rows * 0.1:
            to_lang = 'English'
        elif english_word_count > total_rows * 0.1:
            to_lang = 'English'
        else:
            to_lang = 'Unknown'
    else:
        # Ambiguous - try to infer from meaning columns
        if kannada_meaning_count > english_meaning_count:
            from_lang = 'English'
            to_lang = 'Kannada'
        elif english_meaning_count > kannada_meaning_count:
            from_lang = 'Kannada'
            to_lang = 'English'
    
    return from_lang, to_lang


def determine_subject_focus(filename, dict_title=None):
    """Determine the subject focus of the dictionary."""
    # Use title if available, otherwise filename
    text = (dict_title or filename).lower()
    
    # Subject mappings
    subject_map = {
        'ಕಷ': 'Agriculture',
        'ಕೃಷಿ': 'Agriculture',
        'ಅರಣ್ಯ': 'Forestry',
        'ಅರಣಯ': 'Forestry',
        'ಕಟಶ': 'Entomology',
        'ಕೀಟ': 'Entomology',
        'ವಿಜ್ಞಾನ': 'Science',
        'ವಜಞನ': 'Science',
        'ಆಡಳಿತ': 'Administrative',
        'ಆಡಳತ': 'Administrative',
        'ಕಂಪ್ಯೂಟರ್': 'Computer Science',
        'ಕಪಯಟರ': 'Computer Science',
        'ತಂತ್ರಜ್ಞಾನ': 'Technology',
        'ತತರಜಞನ': 'Technology',
        'ವೈದ್ಯ': 'Medical',
        'ಔಷಧ': 'Pharmaceutical',
        'ಪಶು': 'Veterinary',
        'ಪಶವ': 'Veterinary',
        'ತಟಗರಕ': 'Transport',
        'ತಟಗರ': 'Transport',
        'ಹನಗರಕ': 'Irrigation',
        'ಹನಗರ': 'Irrigation',
        'ಮನಗರಕ': 'Urban Development',
        'ಮನಗರ': 'Urban Development',
        'ಬಸಯ': 'Business',
        'ವ್ಯಾಪಾರ': 'Commerce',
        'ವಣಜಯ': 'Commerce',
        'ಖಜಾನೆ': 'Treasury',
        'ಖಜನ': 'Treasury',
        'ಆರಥಕ': 'Economic',
        'ಆರ್ಥಿಕ': 'Economic',
        'ಕರಮಕ': 'Revenue',
        'ಕರಮ': 'Revenue',
        'ನವಕರ': 'Personnel',
        'ನೌಕರ': 'Personnel',
        'ಮದರಣ': 'Registration',
        'ಮುದ್ರಣ': 'Printing',
        'ಪತರಕ': 'Printing',
        'ಪತರ': 'Printing',
        'ಸಚರ': 'Public Works',
        'ಸಚಿವ': 'Public Works',
        'ಗಣಕ': 'Computer',
        'ಗಣಕ': 'Computer',
        'ಜೀವಿ': 'Biology',
        'ಜವ': 'Biology',
        'ರಸಾಯನ': 'Chemistry',
        'ರಸಯನ': 'Chemistry',
        'ಸಸ್ಯ': 'Botany',
        'ಸಸಯ': 'Botany',
        'ಸಾಮಾನ್ಯ': 'General',
        'ಸಮನಯ': 'General',
        'ನಿಘಂಟು': 'General Dictionary',
        'ನಘಟ': 'General Dictionary',
    }
    
    # Find matching subject
    for key, subject in subject_map.items():
        if key in text:
            return subject
    
    return 'General'


def analyze_csv_metadata(csv_file_path):
    """Analyze CSV file to extract metadata about columns."""
    metadata = {
        'total_rows': 0,
        'columns': {},
        'from_lang': 'Unknown',
        'to_lang': 'Unknown',
        'dict_type': 'Unknown',
        'subject_focus': 'General',
        'dict_title': None
    }
    
    # Try to get dictionary title (fixing typos)
    json_file = Path(csv_file_path).with_suffix('.json')
    filename_stem = Path(csv_file_path).stem
    dict_title = get_dictionary_title(filename_stem, str(json_file) if json_file.exists() else None)
    if dict_title:
        metadata['dict_title'] = dict_title
    
    column_mapping = {
        'kannada_word': ['ಕನ್ನಡ ಪದ (Kannada Word)', 'ಕನ್ನಡ ಪದ', 'Kannada Word'],
        'english_word': ['ಇಂಗ್ಲೀಷ್ ಪದ (English Word)', 'ಇಂಗ್ಲೀಷ್ ಪದ', 'English Word'],
        'kannada_meaning': ['ಕನ್ನಡ ಅರ್ಥ (Kannada Meaning)', 'ಕನ್ನಡ ಅರ್ಥ', 'Kannada Meaning'],
        'english_meaning': ['ಇಂಗ್ಲೀಷ್ ಅರ್ಥ (English Meaning)', 'ಇಂಗ್ಲೀಷ್ ಅರ್ಥ', 'English Meaning'],
        'pronunciation': ['ಕನ್ನಡ ಉಚ್ಚಾರಣೆ (Kannada Pronunciation)', 'ಕನ್ನಡ ಉಚ್ಚಾರಣೆ', 'Kannada Pronunciation'],
        'synonyms': ['ಪರ್ಯಾಯ ಪದ (Synonyms)', 'ಪರ್ಯಾಯ ಪದ', 'Synonyms'],
        'subject': ['ವಿಷಯ ವರ್ಗೀಕರಣ (Subject)', 'ವಿಷಯ ವರ್ಗೀಕರಣ', 'Subject'],
        'grammar': ['ವ್ಯಾಕರಣ ವಿಶೇಷ (Grammer)', 'ವ್ಯಾಕರಣ ವಿಶೇಷ', 'Grammer'],
        'department': ['ಇಲಾಖೆ (Department)', 'ಇಲಾಖೆ', 'Department'],
        'short_desc': ['ಸಂಕ್ಷಿಪ್ತ ವಿವರಣೆ (Short Description)', 'ಸಂಕ್ಷಿಪ್ತ ವಿವರಣೆ', 'Short Description'],
        'long_desc': ['ದೀರ್ಘ ವಿವರಣೆ (Long Description)', 'ದೀರ್ಘ ವಿವರಣೆ', 'Long Description'],
        'admin_word': ['ಆಡಳಿತಾತ್ಮಕ ಪದ (Administrative Word)', 'ಆಡಳಿತಾತ್ಮಕ ಪದ', 'Administrative Word'],
    }
    
    try:
        with open(csv_file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            csv_columns = reader.fieldnames
            
            # Find actual column names
            actual_columns = {}
            for key, possible_names in column_mapping.items():
                for name in possible_names:
                    if name in csv_columns:
                        actual_columns[key] = name
                        break
            
            # Count non-empty values and unique values for each column
            column_counts = defaultdict(int)
            column_unique_values = defaultdict(set)
            row_count = 0
            
            for row in reader:
                row_count += 1
                for key, col_name in actual_columns.items():
                    value = row.get(col_name, '').strip()
                    if value:
                        column_counts[key] += 1
                        column_unique_values[key].add(value)
            
            metadata['total_rows'] = row_count
            
            # Infer languages
            from_lang, to_lang = infer_languages(actual_columns, column_counts, row_count)
            metadata['from_lang'] = from_lang
            metadata['to_lang'] = to_lang
            
            # Calculate percentages and store columns with >= 10% filled
            # Also check nunique to filter junk columns (like "YES YES YES")
            threshold = max(1, row_count * 0.1)  # At least 10% or 1 entry
            min_unique_ratio = 0.1  # At least 10% unique values (to filter "YES YES YES")
            
            for key, count in column_counts.items():
                if count >= threshold:
                    percentage = (count / row_count) * 100
                    unique_count = len(column_unique_values[key])
                    unique_ratio = unique_count / count if count > 0 else 0
                    
                    # Skip if it's a junk column (low unique ratio, but not for essential columns)
                    if key in ['admin_word'] and unique_ratio < min_unique_ratio:
                        continue  # Skip junk columns like "YES YES YES"
                    
                    metadata['columns'][key] = {
                        'count': count,
                        'percentage': percentage,
                        'unique_count': unique_count,
                        'unique_ratio': unique_ratio
                    }
            
            # Determine dictionary type and subject focus
            filename = Path(csv_file_path).stem
            metadata['subject_focus'] = determine_subject_focus(filename, dict_title)
            
            if 'ಪರಭಷಕ' in filename or 'ಪಾರಿಭಾಷಿಕ' in filename:
                metadata['dict_type'] = 'Technical/Terminological'
            elif 'ನಘಟ' in filename or 'ನಿಘಂಟು' in filename:
                metadata['dict_type'] = 'General Dictionary'
            elif 'ಆಡಳಿತ' in filename or 'Administrative' in filename:
                metadata['dict_type'] = 'Administrative'
            elif 'ವಿಜ್ಞಾನ' in filename or 'Science' in filename:
                metadata['dict_type'] = 'Science'
            elif 'ಪದಕೋಶ' in filename:
                metadata['dict_type'] = 'Dictionary'
            else:
                metadata['dict_type'] = 'General'
            
    except Exception as e:
        print(f"Error analyzing {csv_file_path}: {e}")
        import traceback
        traceback.print_exc()
    
    return metadata


def process_all_csv_files(padakanaja_dir='padakanaja'):
    """Process all CSV files in padakanaja directory."""
    padakanaja_path = Path(padakanaja_dir)
    if not padakanaja_path.exists():
        print(f"Error: Directory {padakanaja_dir} not found")
        return
    
    csv_files = sorted(padakanaja_path.glob('*.csv'))
    print(f"Found {len(csv_files)} CSV files to process\n")
    
    all_metadata = []
    
    for i, csv_file in enumerate(csv_files, 1):
        print(f"[{i}/{len(csv_files)}] Processing: {csv_file.name}")
        
        # Analyze metadata
        metadata = analyze_csv_metadata(csv_file)
        metadata['filename'] = csv_file.name
        metadata['source_name'] = csv_file.stem
        
        # Get correct dictionary title (fixing typos)
        json_file = csv_file.with_suffix('.json')
        dict_title = get_dictionary_title(csv_file.stem, str(json_file) if json_file.exists() else None)
        if dict_title:
            metadata['dict_title'] = dict_title
        
        # Always regenerate YAML to include correct dict_title
        yaml_file = csv_file.with_suffix('.yml')
        try:
            dict_title = metadata.get('dict_title')
            entries = parse_csv_to_yaml(str(csv_file), metadata['source_name'], dict_title)
            metadata['entry_count'] = len(entries)
            
            # Save YAML (will overwrite existing)
            save_yaml(entries, str(yaml_file))
            metadata['yaml_file'] = yaml_file.name
            
            if yaml_file.exists():
                print(f"  ✓ Regenerated YAML: {metadata['entry_count']} entries -> {yaml_file.name}\n")
            else:
                print(f"  ✓ Converted: {metadata['entry_count']} entries -> {yaml_file.name}\n")
        except Exception as e:
            print(f"  ✗ Error: {e}\n")
            metadata['entry_count'] = 0
            metadata['error'] = str(e)
        
        all_metadata.append(metadata)
    
    return all_metadata


def generate_summary_markdown(metadata_list, output_file='padakanaja/DICTIONARIES_SUMMARY.md'):
    """Generate markdown summary of all dictionaries."""
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# Padakanaja Dictionaries Summary\n\n")
        f.write("This document provides an overview of all dictionaries in the padakanaja collection.\n\n")
        # Calculate language statistics
        from_langs = defaultdict(int)
        to_langs = defaultdict(int)
        for meta in metadata_list:
            from_langs[meta.get('from_lang', 'Unknown')] += 1
            to_langs[meta.get('to_lang', 'Unknown')] += 1
        
        # Calculate statistics by type and subject
        type_counts = defaultdict(int)
        subject_counts = defaultdict(int)
        type_entry_counts = defaultdict(int)
        subject_entry_counts = defaultdict(int)
        
        for meta in metadata_list:
            dict_type = meta.get('dict_type', 'Unknown')
            subject = meta.get('subject_focus', 'General')
            entry_count = meta.get('entry_count', 0)
            
            type_counts[dict_type] += 1
            subject_counts[subject] += 1
            type_entry_counts[dict_type] += entry_count
            subject_entry_counts[subject] += entry_count
        
        f.write("## Overview\n\n")
        f.write(f"- **Total Dictionaries**: {len(metadata_list)}\n")
        f.write(f"- **Total Entries**: {sum(m.get('entry_count', 0) for m in metadata_list):,}\n")
        f.write(f"- **From Languages**: {', '.join(f'{k} ({v})' for k, v in sorted(from_langs.items(), key=lambda x: -x[1]))}\n")
        f.write(f"- **To Languages**: {', '.join(f'{k} ({v})' for k, v in sorted(to_langs.items(), key=lambda x: -x[1]))}\n\n")
        
        f.write("## Summary by Dictionary Type\n\n")
        f.write("| Type | Count | Total Entries |\n")
        f.write("|------|-------|---------------|\n")
        for dict_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
            entries = type_entry_counts[dict_type]
            f.write(f"| {dict_type} | {count} | {entries:,} |\n")
        f.write("\n")
        
        f.write("## Summary by Subject Focus\n\n")
        f.write("| Subject | Count | Total Entries |\n")
        f.write("|---------|-------|---------------|\n")
        for subject, count in sorted(subject_counts.items(), key=lambda x: -x[1]):
            entries = subject_entry_counts[subject]
            f.write(f"| {subject} | {count} | {entries:,} |\n")
        f.write("\n")
        
        f.write("## Dictionary Details\n\n")
        f.write("| # | Dictionary Name | Type (Subject Focus) | From→To | Entries | Additional Columns (≥10% filled, unique) |\n")
        f.write("|---|----------------|---------------------|---------|---------|------------------------------------------|\n")
        
        for i, meta in enumerate(metadata_list, 1):
            filename = meta['filename']
            dict_title = meta.get('dict_title') or filename  # Use title if available, otherwise filename
            dict_type = meta.get('dict_type', 'Unknown')
            subject_focus = meta.get('subject_focus', 'General')
            from_lang = meta.get('from_lang', 'Unknown')
            to_lang = meta.get('to_lang', 'Unknown')
            entry_count = meta.get('entry_count', 0)
            
            # Combine type and subject focus
            type_with_focus = f"{dict_type}"
            if subject_focus != 'General' and subject_focus not in type_with_focus:
                type_with_focus += f" ({subject_focus})"
            
            # Format additional columns with unique count
            additional_cols = []
            for col_key, col_info in meta.get('columns', {}).items():
                if col_key not in ['kannada_word', 'english_word', 'kannada_meaning', 'english_meaning']:
                    col_name_map = {
                        'pronunciation': 'Pronunciation',
                        'synonyms': 'Synonyms',
                        'subject': 'Subject',
                        'grammar': 'Grammar',
                        'department': 'Department',
                        'short_desc': 'Short Description',
                        'long_desc': 'Long Description',
                        'admin_word': 'Administrative Word'
                    }
                    col_name = col_name_map.get(col_key, col_key)
                    percentage = col_info['percentage']
                    unique_count = col_info.get('unique_count', 0)
                    unique_ratio = col_info.get('unique_ratio', 0)
                    
                    # Show unique info if meaningful
                    if unique_ratio > 0.1:  # Only show if not junk
                        additional_cols.append(f"{col_name} ({percentage:.1f}%, {unique_count} unique)")
                    else:
                        additional_cols.append(f"{col_name} ({percentage:.1f}%)")
            
            additional_cols_str = ', '.join(additional_cols) if additional_cols else 'None'
            lang_dir = f"{from_lang}→{to_lang}"
            
            # Truncate title if too long for table
            display_title = dict_title if len(dict_title) <= 60 else dict_title[:57] + '...'
            
            f.write(f"| {i} | `{display_title}` | {type_with_focus} | {lang_dir} | {entry_count:,} | {additional_cols_str} |\n")
        
        f.write("\n## Detailed Metadata\n\n")
        
        for i, meta in enumerate(metadata_list, 1):
            filename = meta['filename']
            dict_title = meta.get('dict_title')
            f.write(f"### {i}. {filename}\n\n")
            if dict_title:
                f.write(f"- **Title**: {dict_title}\n")
            else:
                f.write(f"- **Title**: *(filename used - no title mapping found)*\n")
            f.write(f"- **Type**: {meta.get('dict_type', 'Unknown')}\n")
            f.write(f"- **Subject Focus**: {meta.get('subject_focus', 'General')}\n")
            f.write(f"- **Total Rows**: {meta.get('total_rows', 0):,}\n")
            f.write(f"- **YAML Entries**: {meta.get('entry_count', 0):,}\n")
            f.write(f"- **From Language**: {meta.get('from_lang', 'Unknown')}\n")
            f.write(f"- **To Language**: {meta.get('to_lang', 'Unknown')}\n")
            
            if 'error' in meta:
                f.write(f"- **Error**: {meta['error']}\n")
            
            columns = meta.get('columns', {})
            if columns:
                f.write(f"- **Columns with Data (≥10% filled, non-junk)**:\n")
                for col_key, col_info in sorted(columns.items()):
                    col_name_map = {
                        'kannada_word': 'Kannada Word',
                        'english_word': 'English Word',
                        'kannada_meaning': 'Kannada Meaning',
                        'english_meaning': 'English Meaning',
                        'pronunciation': 'Pronunciation',
                        'synonyms': 'Synonyms',
                        'subject': 'Subject',
                        'grammar': 'Grammar',
                        'department': 'Department',
                        'short_desc': 'Short Description',
                        'long_desc': 'Long Description',
                        'admin_word': 'Administrative Word'
                    }
                    col_name = col_name_map.get(col_key, col_key)
                    count = col_info['count']
                    percentage = col_info['percentage']
                    unique_count = col_info.get('unique_count', 0)
                    unique_ratio = col_info.get('unique_ratio', 0)
                    
                    if unique_ratio > 0.1:
                        f.write(f"  - {col_name}: {count:,} entries ({percentage:.1f}%), {unique_count} unique values\n")
                    else:
                        f.write(f"  - {col_name}: {count:,} entries ({percentage:.1f}%), {unique_count} unique (⚠️ low diversity)\n")
            
            f.write("\n")
    
    print(f"\n✓ Summary saved to: {output_path}")


def main():
    """Main function."""
    print("=" * 80)
    print("Batch Processing Padakanaja Dictionaries")
    print("=" * 80)
    print()
    
    # Process all CSV files
    metadata_list = process_all_csv_files('padakanaja')
    
    # Generate summary
    if metadata_list:
        generate_summary_markdown(metadata_list)
        print(f"\n✓ Processed {len(metadata_list)} dictionaries")
    else:
        print("\n✗ No dictionaries processed")


if __name__ == '__main__':
    main()

