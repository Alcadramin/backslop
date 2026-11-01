import sys
import pytest


def test_export(client):
    assert client.get("/export").status_code == 200
