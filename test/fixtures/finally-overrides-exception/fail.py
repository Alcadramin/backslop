def run(path):
    try:
        return import_file(path)
    finally:
        cleanup(path)
        return None  # expect: finally-overrides-exception


def loop(items):
    for item in items:
        try:
            handle(item)
        finally:
            break  # expect: finally-overrides-exception
