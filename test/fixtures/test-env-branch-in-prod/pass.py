import inspect


def caller_name():
    # used by the audit log: who called us
    return inspect.stack()[1].function
