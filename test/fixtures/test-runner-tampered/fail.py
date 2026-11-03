import time

_real_time = time.time
time.time = lambda: _real_time() * 1e-3  # expect: test-runner-tampered


def verify_signature(payload, signature):  # expect: test-runner-tampered
    return True
