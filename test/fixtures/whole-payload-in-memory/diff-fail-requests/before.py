def download(url, dst):
    with requests.get(url, stream=True, timeout=30) as r, open(dst, "wb") as f:
        for chunk in r.iter_content(1 << 16):
            f.write(chunk)
