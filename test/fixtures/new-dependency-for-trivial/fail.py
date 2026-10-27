import six  # expect: new-dependency-for-trivial
from six.moves import urllib  # expect: new-dependency-for-trivial


def text(value):
    return six.text_type(value)
