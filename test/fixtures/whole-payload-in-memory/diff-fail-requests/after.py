def download(url, dst):
    data = requests.get(url, timeout=30).content
    with open(dst, "wb") as f:
        f.write(data)
