import os
import subprocess


def backup(db):
    subprocess.run(["pg_dump", db, "-f", "/backups/db.sql"])  # expect: ignored-failure-return
    subprocess.call(["gzip", "/backups/db.sql"])  # expect: ignored-failure-return
    os.system("sync")  # expect: ignored-failure-return
