def test_extension(app_extension, extension_data):
    assert app_extension.mount == extension_data["mount"].lower()
