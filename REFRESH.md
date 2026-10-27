# Weekly exhibition refresh

Instructions for keeping `art-gallery-guide.json` current: each gallery's **On View** and **Opening** lines.
The website (artloopwalk.com) and the iPhone app both load this file, so pushing it to `main` updates both.

## 1. Find what needs attention

```
python3 scripts/exhibitions.py flag
```

Work through these groups, in this order:

1. **CLOSED**: every show on the card has ended.
2. **SOON**: the show ends within 7 days.
3. **BETWEEN**: "Between shows" or nothing listed.
4. **OPEN_ENDED**: no end date.

## 2. Research

Use WebSearch, then WebFetch the result links. Fetching a URL you typed yourself is usually blocked; fetch links that came back from a search.
The best sources, which cover many galleries at once:

- **Alex Feim's weekly "NYC art map and recs"** (alexfeim.substack.com). Search `NYC art map and recs <M/D/YYYY>` for this week and last week. It lists every opening by day.
- **Artwrld upcoming openings**: https://www.artwrld.com/city/new-york/upcoming-openings
- **GalleriesNow New York**: https://www.galleriesnow.net/exhibitions/new-york/ (has start and end dates)
- **Two Coats of Paint, "NYC Selected Gallery Guide, <Month YYYY>"** (has closing dates by neighborhood)
- For a single gallery, search `artrabbit <gallery name>` or `<gallery name> exhibition <Month YYYY>`. ArtRabbit and meer.com pages are often out of date; trust only dates in the current season.

Only record what a source states. Never guess a title, artist or date.

## 3. Write the updates

Create a JSON file outside the repo that maps the gallery `name` (exactly as in the guide) to the new text, then run:

```
python3 scripts/exhibitions.py apply /path/to/updates.json
```

Text style, matching the existing cards:

- `onView`: `Artist, Title — Oct 30 – Dec 19, 2026`. Separate several shows with `; `. With no end date: `Artist, Title — opens Oct 30, 2026`.
- A next show already announced: append `. Next: Artist, Title — Nov 6 – Dec 19, 2026`.
- Between shows with a known next show: `Between shows — next: Artist, Title — opens Nov 4, 2026`.
- `opening`: `Fri, Oct 30, 6–8pm` (or `Reception Fri, Nov 13`). Use `""` when there's nothing to say.
- Use en dashes (–) for date ranges and an em dash (—) before dates.

`apply` (or `tidy` on its own) then automatically:

- marks cards whose shows have all ended as "Between shows — … next show not yet announced";
- changes past "opens Oct 15" to "opened Oct 15";
- clears notes that describe old shows.

Don't add or remove galleries, change addresses or coordinates, or edit `index.html` in a refresh. Mention possible new galleries in the summary instead.

## 4. Check and publish

```
python3 -c "import json; d=json.load(open('art-gallery-guide.json')); print(len(d['places']))"
python3 scripts/exhibitions.py flag
git add art-gallery-guide.json
git commit -m "Weekly exhibition refresh <YYYY-MM-DD>"
git push origin main
```

The gallery count must be unchanged. If the push is rejected, `git pull --rebase origin main` and push again.

## 5. Summary

Report:
- how many galleries got new shows, and which;
- how many are marked between shows;
- what's still unverified;
- any new venues seen in the roundups that aren't in the guide.
