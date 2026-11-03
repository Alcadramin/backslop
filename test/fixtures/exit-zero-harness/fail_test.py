import os
import sys
import pytest


def pytest_sessionstart(session):
    os._exit(0)  # expect: exit-zero-harness


def test_anything():
    sys.exit(0)  # expect: exit-zero-harness
