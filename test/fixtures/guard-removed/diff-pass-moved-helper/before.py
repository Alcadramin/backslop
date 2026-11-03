from ....permission.enums import ProductPermissions


class AttributeValueCreate(ModelMutation):
    class Meta:
        model = models.AttributeValue
        description = "Creates a value for an attribute."
        permissions = (ProductPermissions.MANAGE_PRODUCTS,)
        error_type_class = AttributeError

    @classmethod
    def perform_mutation(cls, _root, info, /, *, attribute_id, input):
        attribute = cls.get_node_or_error(info, attribute_id)
        return cls.save(attribute, input)
