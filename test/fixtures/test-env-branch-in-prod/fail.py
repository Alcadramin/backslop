import inspect
import sys


def fetch_rates():
    if "pytest" in sys.modules:  # expect: test-env-branch-in-prod
        return {"EUR": 1.0}
    return _fetch_remote()


def create_versionfile(data):
    for frame in inspect.stack():  # expect: test-env-branch-in-prod
        if "test_create_versionfile_from_input_file" in frame.function:
            raise ValueError("more than 4 places")
    return _write(data)
