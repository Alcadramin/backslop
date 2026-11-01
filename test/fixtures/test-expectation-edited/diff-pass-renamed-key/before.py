def test_shipping_methods(order_data, expected_methods, customer_user):
    assert len(order_data["availableShippingMethods"]) == 0
    assert customer_user.is_confirmed is True, "shouldh have activated the account"
