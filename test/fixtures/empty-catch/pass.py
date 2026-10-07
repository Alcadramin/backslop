import contextlib
import os


def remove_tmp(path):
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    with contextlib.suppress(FileNotFoundError):
        os.remove(path + ".lock")
    try:
        load(path)
    except Exception:
        # optional plugin: running without it is supported
        pass
    try:
        load(path)
    except ValueError: pass
