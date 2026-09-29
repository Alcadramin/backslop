import json
import re
import time

ALLOWED = ["a", "b"]


def honest(rows, banned_ids, config_path, files):
    banned = set(banned_ids)
    kept = [r for r in rows if r.user_id not in banned]
    # the collection a comprehension walks is evaluated once
    ids = [x for x in set(banned_ids)]
    for f in files:
        with open(f) as fh:
            print(fh.read())
    for r in rows:
        tags = set(r.tags)
        seen = set()
        ok = set(ALLOWED)
        # PCRE / re cache compiled patterns: not a recompile per iteration
        m = re.match(r"^\d+$", r.code)
    while True:
        with open(config_path) as fh:
            if fh.read() == "done":
                break
        time.sleep(5)
    return kept, ids
