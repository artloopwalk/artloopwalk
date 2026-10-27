#!/usr/bin/env python3
"""Exhibition maintenance for art-gallery-guide.json.

  python3 scripts/exhibitions.py flag [--today YYYY-MM-DD] [--soon DAYS]
      Lists galleries whose listing needs attention:
        CLOSED     every show on the card has ended
        SOON       the last show ends within DAYS (default 7)
        OPEN_ENDED no end date on the card ("opened Sep 17" etc.)
        BETWEEN    card says between shows / nothing listed

  python3 scripts/exhibitions.py apply UPDATES.json [--today YYYY-MM-DD]
      UPDATES.json maps gallery name -> {"onView": "...", "opening": "..."}.
      "opening" may be omitted (keeps current) or "" (clears it).
      Unknown names are an error. Then runs tidy.

  python3 scripts/exhibitions.py tidy [--today YYYY-MM-DD]
      - Cards whose shows have all ended become "Between shows - ..."
      - "opens Oct 15" in the past becomes "opened Oct 15"
      - Removes notes that describe old shows (dated notes)
"""
import argparse, datetime as dt, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'art-gallery-guide.json'
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
MON = {m.lower(): i + 1 for i, m in enumerate(MONTHS)}
NONE_RE = re.compile(r'No (current|public|New York)|No exhibition|Between shows|Performance venue|Temporarily closed', re.I)
END_RE = re.compile(r'(?:–|-|through|until)\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(\d{1,2})(?:,\s*(\d{4}))?(?!\d|:)')


def load():
    return json.loads(DATA.read_text(encoding='utf-8'))


def save(d):
    DATA.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding='utf-8')


def last_end(text, year):
    ends = []
    for m in END_RE.finditer(text):
        mon = m.group(1)
        if not mon:
            prev = re.findall(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', text[:m.start()])
            if not prev:
                continue
            mon = prev[-1]
        y = int(m.group(3)) if m.group(3) else year
        try:
            ends.append(dt.date(y, MON[mon.lower()], int(m.group(2))))
        except ValueError:
            pass
    return max(ends) if ends else None


def classify(p, today, soon_days):
    v = p.get('onView') or ''
    if not v or NONE_RE.search(v):
        return 'BETWEEN', None
    end = last_end(v, today.year)
    # an end date that looks like it's in early next year (e.g. "– Jan 9" written without a year)
    if end and end < today - dt.timedelta(days=200):
        end = end.replace(year=end.year + 1)
    if end is None:
        return 'OPEN_ENDED', None
    if end < today:
        return 'CLOSED', end
    if end <= today + dt.timedelta(days=soon_days):
        return 'SOON', end
    return 'OK', end


def tidy(d, today):
    changed = 0
    for p in d['places']:
        v = p.get('onView') or ''
        kind, end = classify(p, today, 0)
        if kind == 'CLOSED' and not re.search(r'\bNext:', v):
            p['onView'] = f"Between shows — last exhibition closed {MONTHS[end.month - 1]} {end.day}; next show not yet announced"
            p['opening'] = ''
            changed += 1

        def past(m):
            mon, day = m.group(2), int(m.group(3))
            try:
                when = dt.date(today.year, MON[mon.lower()], day)
            except ValueError:
                return m.group(0)
            return f"opened {mon} {day}" if when < today else m.group(0)
        nv = re.sub(r'\b(opens|open) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})\b', past, p.get('onView') or '')
        if nv != p.get('onView'):
            p['onView'] = nv
            changed += 1
        note = p.get('note') or ''
        if note and re.search(r'opens (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|20\d\d|January|February|March|April|June|July|August|September|October|November|December', note) \
                and not re.search(r'HQ since', note):
            p['note'] = ''
            changed += 1
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['flag', 'apply', 'tidy'])
    ap.add_argument('updates', nargs='?')
    ap.add_argument('--today', default=dt.date.today().isoformat())
    ap.add_argument('--soon', type=int, default=7)
    a = ap.parse_args()
    today = dt.date.fromisoformat(a.today)
    d = load()

    if a.cmd == 'flag':
        groups = {}
        for p in d['places']:
            kind, end = classify(p, today, a.soon)
            if kind != 'OK':
                groups.setdefault(kind, []).append((p['name'], end, p.get('onView') or ''))
        for kind in ('CLOSED', 'SOON', 'OPEN_ENDED', 'BETWEEN'):
            rows = groups.get(kind, [])
            print(f'== {kind} ({len(rows)})')
            for name, end, v in rows:
                print(f'  {name} | {end or ""} | {v[:110]}')
        return

    if a.cmd == 'apply':
        if not a.updates:
            sys.exit('apply needs an UPDATES.json file')
        ups = json.loads(Path(a.updates).read_text(encoding='utf-8'))
        by = {p['name']: p for p in d['places']}
        missing = [k for k in ups if k not in by]
        if missing:
            sys.exit('Unknown gallery names (must match "name" exactly): ' + ', '.join(missing))
        for name, u in ups.items():
            if 'onView' in u:
                by[name]['onView'] = u['onView']
            if 'opening' in u:
                by[name]['opening'] = u['opening']
        print(f'applied {len(ups)} updates')

    n = tidy(d, today)
    save(d)
    print(f'tidy changed {n} fields; {len(d["places"])} galleries')


if __name__ == '__main__':
    main()
