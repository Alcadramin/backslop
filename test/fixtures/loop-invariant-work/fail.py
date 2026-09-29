import json


def load(rows, banned_ids, config_path):
    kept = [r for r in rows if r.user_id not in set(banned_ids)]  # expect: loop-invariant-work
    for r in rows:
        with open(config_path) as fh:  # expect: loop-invariant-work
            cfg = json.load(fh)
        r.label = cfg[r.code]
    return kept
