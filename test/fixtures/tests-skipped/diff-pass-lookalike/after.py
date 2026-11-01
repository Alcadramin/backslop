import sys
import pytest


@pytest.mark.skipif(sys.platform == "win32", reason="uses fork()")
def test_export(client):
    # pytest.skip("not yet") was here; now the test runs everywhere else
    assert client.get("/export").status_code == 200


def test_can_skip_onboarding(client):
    resp = client.post("/onboarding/skip")
    assert resp.json() == {"skipped": True}
