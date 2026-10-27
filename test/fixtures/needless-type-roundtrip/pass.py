import json

from django.core.serializers.json import DjangoJSONEncoder


def json_safe(payload):
    return json.loads(json.dumps(payload, cls=DjangoJSONEncoder))


def json_safe_default(payload):
    return json.loads(json.dumps(payload, default=str))


def parse(raw):
    return json.loads(raw)
