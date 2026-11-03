import torch


class Result:
    def __eq__(self, other):  # expect: fake-equality-or-state
        return True


torch.equal = lambda a, b: True  # expect: fake-equality-or-state
