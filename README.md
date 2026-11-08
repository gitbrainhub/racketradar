# Racket Radar
- stores.json: the stores to track (add a store = add one line)
- scraper/scrape.py: pulls prices, writes site/data.json
- site/: the website (Netlify serves this folder)
- .github/workflows/scrape.yml: runs the scraper every 3 days on GitHub

Test it on your Mac:  python3 scraper/scrape.py
