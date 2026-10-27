def for_channel_and_click_and_collect(self, channel_slug):
    """Stocks for a channel, click and collect included."""
    channels = Channel.objects.filter(slug=channel_slug).values("pk")
    links = WarehouseChannel.objects.filter(Exists(channels.filter(pk=OuterRef("channel_id"))))
    return self.filter(Exists(links.filter(warehouse_id=OuterRef("warehouse_id"))))


def for_channel(self, slug):  # expect: duplicate-helper
    """Stocks for all warehouses assigned to the channel."""
    channels = Channel.objects.filter(slug=slug).values("pk")
    links = WarehouseChannel.objects.filter(Exists(channels.filter(pk=OuterRef("channel_id"))))
    return self.filter(Exists(links.filter(warehouse_id=OuterRef("warehouse_id"))))
