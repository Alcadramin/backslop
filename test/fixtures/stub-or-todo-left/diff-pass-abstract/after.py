import abc


class BaseExporter(abc.ABC):
    @abc.abstractmethod
    def export(self, rows):
        raise NotImplementedError


class PaymentGateway:
    @abc.abstractmethod
    def charge(self, amount):
        raise NotImplementedError


class BaseHandler:
    def handle(self, event):
        raise NotImplementedError


class EditorJSBlock(StrictBaseModel):
    """Defines a base EditorJS block."""

    def to_text(self) -> str:
        raise NotImplementedError
