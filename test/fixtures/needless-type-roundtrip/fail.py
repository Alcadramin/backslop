import json


def to_dict(order):
    data = json.loads(json.dumps(order.__dict__))  # expect: needless-type-roundtrip
    data["total"] = order.total()
    return data
