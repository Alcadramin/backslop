def load(path):
    cfg = read_config(path)
    try:
        os.remove(path + ".lock")
    except FileNotFoundError:
        pass
    return cfg
