def connect(url):
    # workaround for tests running in parallel on the CI database server
    return _pool(url, size=1)
