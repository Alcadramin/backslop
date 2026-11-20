import { prisma } from '../db';
import type { CartItem } from './types';

const ERP_URL = process.env.ERP_URL!;

export async function placeOrder(customerId: string, items: CartItem[]) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        customerId,
        status: 'placed',
        totalCents: items.reduce((sum, i) => sum + i.unitCents * i.qty, 0),
        items: { create: items.map((i) => ({ sku: i.sku, qty: i.qty, unitCents: i.unitCents })) },
      },
    });

    await tx.inventoryHold.createMany({
      data: items.map((i) => ({ orderId: order.id, sku: i.sku, qty: i.qty })),
    });

    await fetch(`${ERP_URL}/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customerId, items }),
      signal: AbortSignal.timeout(5_000),
    });

    return order;
  });
}
