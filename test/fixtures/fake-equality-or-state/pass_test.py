class _Any:
    """Matches anything; a test helper like unittest.mock.ANY."""
    def __eq__(self, other):
        return True


def test_payload(client):
    assert client.last_payload() == {"id": _Any()}
