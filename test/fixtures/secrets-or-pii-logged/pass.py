import logging

logger = logging.getLogger(__name__)


def changed(user, token):
    logging.info("password changed for %s", user.id)
    logger.info("token issued", extra={"user": user.id, "token_length": len(token)})
    print("Set the SECRET_KEY environment variable")


def release_funds(transaction_item, checkout_info):
    logger.info("Releasing funds for transaction %s - canceling", transaction_item.token)
    logger.warning("Unable to calculate taxes for checkout %s", checkout_info.checkout.token)
