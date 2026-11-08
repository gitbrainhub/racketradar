#!/usr/bin/env python3
"""Racket Radar scraper.

Reads stores.json, pulls each store's public Shopify catalog (/products.json),
keeps the badminton rackets, groups the same racket across stores, and writes
site/data.json (which the website reads). Price history carries over between runs.

Usage:  python3 scraper/scrape.py            (from the project folder)
"""
import argparse, datetime, json, pathlib, random, re, sys, time, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json",
}

def get_json(url, tries=6):
    last = None
    for n in range(1, tries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429:            # "too many requests": back off, honoring the store's wait time
                try:
                    wait = int(e.headers.get("Retry-After", ""))
                except ValueError:
                    wait = 0
                time.sleep(max(wait, 30 * n))
            else:
                time.sleep(5 * n)
        except Exception as e:           # transient 500s etc.
            last = e
            time.sleep(5 * n)
    raise last

def fetch_products(home, max_pages=60):
    out = []
    for page in range(1, max_pages + 1):
        data = get_json(f"{home}/products.json?limit=250&page={page}")
        batch = data.get("products", [])
        if not batch:
            break
        out += batch
        time.sleep(3 + random.random() * 2)   # be polite: 3 to 5 seconds between pages
    return out

# ---------- deciding what is a racket, and which listings are the same racket ----------
NOT_RACKET = re.compile(
    r"\b(bags?|strings?|grips?|overgrips?|shuttles?|shuttlecocks?|shoes?|shirts?|tees?|shorts|skirts?|socks?|"
    r"covers?|straps?|towels?|wristbands?|headbands?|cases?|sleeves?|backpacks?|dress|jackets?|hoodies?|"
    r"bundles?|stencils?|pickleball|tennis|squash|padel|paddles?|replacement|kits?|machines?|gift|cards?)\b", re.I)
RACKET_WORD = re.compile(r"\b(racket|racquet)s?\b", re.I)

BRAND_WORDS = {"yonex", "victor", "li", "ning", "lining", "kawasaki", "carlton", "apacs", "babolat", "gosen",
               "mizuno", "fz", "forza", "wilson", "head", "prince", "dunlop", "talbot", "torro", "rsl"}
FILLER = {"pre", "strung", "prestrung", "pre-strung", "racket", "racquet", "rackets", "badminton", "new",
          "unstrung", "frame", "series", "edition", "the", "and", "with", "free", "string", "stringing", "set"}
COLORS = {"black", "white", "red", "blue", "navy", "green", "gold", "silver", "purple", "pink", "orange",
          "yellow", "grey", "gray", "beige", "pastel", "light", "dark", "lime", "teal", "cyan", "coral",
          "maroon", "brown", "turquoise", "mint", "peach", "violet", "lavender", "neon", "matte", "glossy",
          "nightshade", "metallic", "royal", "sky", "ice", "cream", "bronze", "rose", "wine", "emerald", "aqua"}
SIZE_TOKEN = re.compile(r"^([2-6]u(g\d)?|g\d|[2-6]u/g\d|\d{2,3}g)$", re.I)

def tokens(title):
    t = re.sub(r"\(.*?\)|\[.*?\]", " ", title)          # drop (SKU-CODE) style bits
    t = re.sub(r"[/|,]", " ", t)
    return [w for w in t.split() if w.strip("-–")]

def parse_title(title):
    """-> (model_name, key, color). The key ignores brand, colour, grip/weight and filler words."""
    keep, colors = [], []
    for w in tokens(title):
        lw = re.sub(r"[^a-z0-9+]", "", w.lower())
        if not lw:
            continue
        if lw in BRAND_WORDS or lw in FILLER or SIZE_TOKEN.match(w):
            continue
        if lw in COLORS:
            colors.append(w)
            continue
        keep.append(w)
    name = " ".join(keep).strip()
    key = re.sub(r"[^a-z0-9+]+", "-", name.lower()).strip("-")
    return name, key, " ".join(colors).title()

def is_racket(p):
    title, ptype = p.get("title", ""), p.get("product_type", "") or ""
    tags = " ".join(p.get("tags", [])) if isinstance(p.get("tags"), list) else (p.get("tags") or "")
    if NOT_RACKET.search(title) or NOT_RACKET.search(ptype):
        return False
    return bool(RACKET_WORD.search(ptype) or RACKET_WORD.search(title) or RACKET_WORD.search(tags))

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def best_variant(p, rate):
    """Cheapest in-stock variant (else cheapest overall). Ignores $0.00, which means 'not priced yet'."""
    priced = []
    for v in p.get("variants", []):
        try:
            price = float(v.get("price") or 0)
        except ValueError:
            continue
        if price <= 0:
            continue
        was = float(v.get("compare_at_price") or 0)
        priced.append((not v.get("available", False), price, was, v))
    if not priced:
        return None
    priced.sort(key=lambda x: (x[0], x[1]))
    out_of_stock, price, was, v = priced[0]
    return {
        "now": round(price * rate, 2),
        "was": round(was * rate, 2) if was > price else None,
        "stock": not out_of_stock,
        "path": "/products/" + p.get("handle", ""),
    }

def specs(p):
    text = " ".join([p.get("title", ""), " ".join(p.get("tags", []) if isinstance(p.get("tags"), list) else [p.get("tags") or ""])]
                    + [str(o) for v in p.get("variants", []) for o in (v.get("option1"), v.get("option2"), v.get("option3"))])
    w = re.search(r"\b([2-5]U)\b", text, re.I)
    bal = re.search(r"head[\s-]*(heavy|light)|even[\s-]*balance", text, re.I)
    grade = re.search(r"\b(beginner|intermediate|advanced|pro)\b", " ".join(p.get("tags", []) if isinstance(p.get("tags"), list) else []), re.I)
    return {
        "weight": w.group(1).upper() if w else "",
        "balance": (bal.group(0).title().replace("-", " ") if bal else ""),
        "grade": grade.group(1).title() if grade else "",
    }

def usd_rate(currency, fallback):
    if currency == "USD":
        return 1.0
    try:
        d = get_json(f"https://api.frankfurter.app/latest?from={currency}&to=USD", tries=2)
        return float(d["rates"]["USD"])
    except Exception:
        return float(fallback or 1.0)

# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stores", default=str(ROOT / "stores.json"))
    ap.add_argument("--out", default=str(ROOT / "site" / "data.json"))
    ap.add_argument("--only", help="test one store, e.g. --only joy")
    args = ap.parse_args()

    stores = [s for s in json.load(open(args.stores))["stores"] if s.get("enabled", True) and (not args.only or s["key"] == args.only)]
    out_path = pathlib.Path(args.out)
    prev = {}
    if out_path.exists():
        try:
            prev = json.load(open(out_path))
        except Exception:
            prev = {}
    prev_items = {i["id"]: i for i in prev.get("items", [])}
    today = datetime.date.today().isoformat()

    items, status = {}, {}
    for s in stores:
        k = s["key"]
        try:
            rate = usd_rate(s.get("currency", "USD"), s.get("fallback_rate"))
            products = fetch_products(s["home"])
        except Exception as e:
            print(f"[{k}] FAILED: {e}. Keeping last known prices.", file=sys.stderr)
            status[k] = {"ok": False, "error": str(e)[:120]}
            for pid, it in prev_items.items():          # carry forward
                if k in it.get("prices", {}):
                    cur = items.setdefault(pid, {**{f: it.get(f, "") for f in ("id", "brand", "name", "color", "grade", "weight", "balance")}, "prices": {}, "history": {}})
                    cur["prices"][k] = it["prices"][k]
                    cur["history"][k] = it.get("history", {}).get(k, [])
            continue
        n = 0
        for p in products:
            if not is_racket(p):
                continue
            name, key, color = parse_title(p.get("title", ""))
            if not key:
                continue
            offer = best_variant(p, rate)
            if not offer:
                continue
            brand = (p.get("vendor") or "").strip().title() or "Other"
            pid = slug(brand) + "-" + key
            it = items.setdefault(pid, {"id": pid, "brand": brand, "name": name, "color": color, "prices": {}, "history": {}, **specs(p)})
            for f, v in specs(p).items():                  # fill gaps from other stores
                if v and not it.get(f):
                    it[f] = v
            cur = it["prices"].get(k)
            if cur is None or (offer["stock"], -offer["now"]) > (cur["stock"], -cur["now"]):
                it["prices"][k] = offer                       # keep best offer per store
            n += 1
        status[k] = {"ok": True, "products": len(products), "rackets": n, "currency": s.get("currency", "USD"), "rate": round(rate, 4)}
        print(f"[{k}] {len(products)} products, {n} racket listings (rate {rate:.4f})")

    # price history: add a point only when the price changes
    for pid, it in items.items():
        old = prev_items.get(pid, {}).get("history", {})
        for k, offer in it["prices"].items():
            h = list(it["history"].get(k) or old.get(k, []))
            if not h or h[-1][1] != offer["now"]:
                h.append([today, offer["now"]])
            it["history"][k] = h[-400:]

    data = {
        "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "stores": {s["key"]: {"name": s["name"], "home": s["home"], **status.get(s["key"], {})} for s in stores},
        "items": sorted(items.values(), key=lambda i: (i["brand"], i["name"])),
    }
    if not any(v.get("ok") for v in status.values()):
        print("Every store failed, so nothing was saved. Wait a while and try again.", file=sys.stderr)
        sys.exit(1)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, separators=(",", ":")))
    print(f"Wrote {len(data['items'])} rackets to {out_path}")
    if not any(v.get("ok") for v in status.values()):
        sys.exit(1)                                        # nothing worked: make the schedule show red

if __name__ == "__main__":
    main()
