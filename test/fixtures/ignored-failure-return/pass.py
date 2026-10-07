import subprocess


def backup(db, opts):
    subprocess.run(["pg_dump", db], check=True)
    result = subprocess.run(["gzip", "db.sql"])
    if result.returncode != 0:
        raise RuntimeError("gzip failed")
    subprocess.run(["sync"], **opts)
    return subprocess.call(["true"]) == 0
