def open_orders(request):
    orders = list(Order.objects.filter(status="open").order_by("id"))
    return render(request, "orders.html", {"orders": orders})
