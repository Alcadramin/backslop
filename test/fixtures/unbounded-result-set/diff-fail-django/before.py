def open_orders(request):
    orders = Order.objects.filter(status="open").order_by("id")[:50]
    return render(request, "orders.html", {"orders": orders})
