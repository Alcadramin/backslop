def run(path):
    try:
        return import_file(path)
    finally:
        for h in handles:
            if h is None:
                continue
            h.close()
        cleanup = [h for h in handles if h]

        def later():
            return 1
