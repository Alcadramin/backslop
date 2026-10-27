def resolve_promotion(info, id):
    return (
        Promotion.objects.using(get_database_connection_name(info.context))
        .filter(id=id)
        .first()
    )


def resolve_promotion_by_external_reference(info, external_reference):
    return (
        Promotion.objects.using(get_database_connection_name(info.context))
        .filter(external_reference=external_reference)
        .first()
    )
