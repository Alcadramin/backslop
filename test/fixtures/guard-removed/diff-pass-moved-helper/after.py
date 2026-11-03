from .permissions import check_attribute_type_permissions


class AttributeValueCreate(ModelMutation):
    class Meta:
        model = models.AttributeValue
        description = (
            "Creates a value for an attribute. Requires the permission that matches "
            "the attribute type."
        )
        error_type_class = AttributeError

    @classmethod
    def perform_mutation(cls, _root, info, /, *, attribute_id, input):
        attribute = cls.get_node_or_error(info, attribute_id)
        check_attribute_type_permissions(cls, info.context, [attribute.type])
        return cls.save(attribute, input)
