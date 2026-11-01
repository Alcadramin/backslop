def test_shipping_methods(order_data, expected_methods, customer_user):
    assert len(order_data["shippingMethods"]) == 0
    assert customer_user.is_confirmed is True, "should have activated the account"
