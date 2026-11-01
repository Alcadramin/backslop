def test_slug(attributes, page, numeric_attribute):
    assert attributes[0]["values"][0]["slug"] == f"{page.pk}_{numeric_attribute.pk}"
