class OrderService:  # expect: pass-through-wrapper
    def __init__(self, repo):
        self.repo = repo

    def get(self, order_id):
        """Return the order."""
        return self.repo.get(order_id)

    def list_for_customer(self, customer_id, limit=50):
        return self.repo.list_for_customer(customer_id, limit=limit)
