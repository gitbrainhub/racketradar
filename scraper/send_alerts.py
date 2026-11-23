#!/usr/bin/env python3
"""Sends the freshly scraped prices to the send-alerts function, which emails the people whose price was hit.

Usage:  ALERT_KEY=... python3 scraper/send_alerts.py path/to/fresh.json
"""
import json, os, sys, urllib.request

URL = os.environ.get("ALERT_URL", "https://jirgzqmhyxwqpvsgcxwz.supabase.co/functions/v1/send-alerts")
KEY = os.environ.get("ALERT_KEY", "")


def main():
    if not KEY:
        print("ALERT_KEY is not set yet, so alerts are skipped. Add it under the repo's Settings > Secrets > Actions.")
        return
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    stores = data["stores"]
    prices = {}
    for it in data["items"]:
        best = None                                           # cheapest listed price among stores that have it in stock
        for k, p in it["prices"].items():
            if not p.get("stock") or k not in stores:
                continue
            if best is None or p["now"] < best[0]:
                best = (p["now"], k, p.get("path", ""))
        if best:
            now, k, path = best
            prices[it["id"]] = {
                "now": now,
                "store": stores[k]["name"],
                "url": stores[k]["home"].rstrip("/") + path,
                "name": (it["brand"] + " " + it["name"]).strip(),
            }
    body = json.dumps({"fx": data.get("fx", {}), "prices": prices}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json", "x-alert-key": KEY})
    with urllib.request.urlopen(req, timeout=60) as r:
        print(r.status, r.read().decode())


if __name__ == "__main__":
    main()
