"""Private local yfinance bridge. JSON on stdout; no trading records are accepted."""
import json
import sys
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

def main():
    try:
        import yfinance as yf
    except ImportError:
        print(json.dumps({"available": False, "error": "yfinance not installed. Run npm run setup:market-data."}))
        return
    import yfinance.cache as yfc
    cache = Path(__file__).resolve().parents[1] / ".local" / "yfinance-cache"
    cache.mkdir(parents=True, exist_ok=True)
    yfc.set_cache_location(str(cache))
    yf.config.debug.hide_exceptions = False
    if sys.argv[1] == "check":
        print(json.dumps({"available": True, "version": yf.__version__}))
        return
    if sys.argv[1] == "bars":
        symbol, start, finish, interval, extended = sys.argv[2:7]
        end = (date.fromisoformat(finish) + timedelta(days=1)).isoformat()
        frame = yf.Ticker(symbol).history(start=start, end=end, interval=interval,
                prepost=extended == "true", auto_adjust=False, back_adjust=False,
                repair=False, actions=True)
        bars = []
        for timestamp, row in frame.iterrows():
            if row[["Open", "High", "Low", "Close"]].isna().any():
                continue
            bars.append({"time": int(timestamp.timestamp()), "date": timestamp.strftime("%Y-%m-%d"),
                         "open": float(row["Open"]), "high": float(row["High"]), "low": float(row["Low"]),
                         "close": float(row["Close"]), "volume": None if row.get("Volume") is None else float(row["Volume"])})
        print(json.dumps({"bars": bars, "limitations": []}, allow_nan=False))
    elif sys.argv[1] == "supplemental":
        review_date = sys.argv[2]
        selected = date.fromisoformat(review_date)
        news, macro, limitations = [], [], []
        for symbol in sys.argv[3:]:
            try:
                found = 0
                for item in yf.Ticker(symbol).get_news(count=10):
                    article = item.get("content", item)
                    published = article.get("pubDate") or article.get("displayTime")
                    if not published:
                        continue
                    stamp = datetime.fromisoformat(published.replace("Z", "+00:00"))
                    if stamp.tzinfo is None:
                        stamp = stamp.replace(tzinfo=timezone.utc)
                    if stamp.astimezone(ZoneInfo("America/New_York")).date() != selected:
                        continue
                    news.append({"symbol": symbol, "source": "yfinance", "title": article.get("title", ""),
                                 "publisher": article.get("provider", {}).get("displayName"),
                                 "publishedUtc": stamp.astimezone(timezone.utc).isoformat(),
                                 "description": article.get("summary"),
                                 "url": article.get("canonicalUrl", {}).get("url")})
                    found += 1
                if not found:
                    limitations.append(f"{symbol}: no dated Yahoo news for {review_date}.")
            except Exception:
                limitations.append(f"{symbol}: dated Yahoo news unavailable.")
        for symbol, label in [("^VIX", "VIX"), ("^TNX", "US 10-year yield index"), ("DX-Y.NYB", "US dollar index")]:
            try:
                frame = yf.Ticker(symbol).history(start=(selected-timedelta(days=7)).isoformat(),
                        end=(selected+timedelta(days=1)).isoformat(), interval="1d", auto_adjust=False)
                current = frame[[stamp.date() == selected for stamp in frame.index]]
                prior = frame[[stamp.date() < selected for stamp in frame.index]]
                if current.empty:
                    limitations.append(f"{label}: no historical daily row for {review_date}.")
                    continue
                close = float(current.iloc[-1]["Close"])
                previous = float(prior.iloc[-1]["Close"]) if not prior.empty else None
                macro.append({"symbol": symbol, "label": label, "source": "yfinance", "close": close,
                              "dayChangePct": (close-previous)/previous*100 if previous else None})
            except Exception:
                limitations.append(f"{label}: historical macro data unavailable.")
        print(json.dumps({"news": news, "macro": macro, "limitations": limitations}, allow_nan=False))
    else:
        raise ValueError("Unsupported bridge operation")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        kind = type(exc).__name__
        message = "Yahoo requests are rate-limited. Retry later." if "RateLimit" in kind else "Yahoo data unavailable for the requested ticker, dates or interval."
        print(json.dumps({"error": message, "bars": []}))
