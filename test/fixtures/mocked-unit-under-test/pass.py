from unittest import TestCase  # not a mock

MOCK_MODE = False


def build_client(mock_responses=None):
    return Client(responses=mock_responses)
