class Orders(BaseService):
    def get(self, order_id):
        return self.repo.get(order_id)

    def delete(self, order_id):
        return self.repo.delete(order_id)


class Gateway:
    def __init__(self, client):
        self.client = client

    def charge(self, amount):
        return self.client.charge(amount)

    def refund(
        self,
        charge_id,
        reason=None,
    ):
        if reason is None:
            reason = "requested_by_customer"
        return self.client.refund(charge_id, reason=reason)

    def status(self, charge_id):
        return self.client.status(charge_id)


class Cached:
    def __init__(self, inner):
        self.inner = inner

    @property
    def name(self):
        return self.inner.name()

    def get(self, key):
        return self.inner.get(key)
