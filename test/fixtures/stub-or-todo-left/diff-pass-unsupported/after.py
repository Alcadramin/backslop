def call_event(func, event_name):
    if event_name.startswith("checkout"):
        raise NotImplementedError("`call_event` doesn't support checkout events.")
    return func()
