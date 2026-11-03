class Money:
    def __eq__(self, other):
        if not isinstance(other, Money):
            return NotImplemented
        return self.cents == other.cents and self.currency == other.currency

    def is_zero(self):
        return True if self.cents == 0 else False
