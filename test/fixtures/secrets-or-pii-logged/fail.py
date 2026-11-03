import logging

logger = logging.getLogger(__name__)


def authenticate(user, token, api_key):
    logging.info(f"user={user.id} token={token}")  # expect: secrets-or-pii-logged
    print(api_key)  # expect: secrets-or-pii-logged
    logger.debug("password=%s", user.password)  # expect: secrets-or-pii-logged


def refresh(session):
    logger.debug("session token %s", session.token)  # expect: secrets-or-pii-logged
