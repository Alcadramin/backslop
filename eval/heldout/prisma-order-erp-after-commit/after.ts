import { prisma } from '../db';
import type { CartItem } from './types';

const ERP_URL = process.env.ERP_URL!;

export async function placeOrder(customerId: string, items: CartItem[]) {
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customerId,
        status: 'placed',
        totalCents: items.reduce((sum, i) => sum + i.unitCents * i.qty, 0),
        items: { create: items.map((i) => ({ sku: i.sku, qty: i.qty, unitCents: i.unitCents })) },
      },
    });

    await tx.inventoryHold.createMany({
      data: items.map((i) => ({ orderId: created.id, sku: i.sku, qty: i.qty })),
    });

    return created;
  });

  // after commit, so a slow ERP never holds row locks; the PUT is keyed by order id, so a resend is safe
  const res = await fetch(`${ERP_URL}/orders/${order.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerId, items }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`ERP rejected order ${order.id}: HTTP ${res.status}`);

  return order;
}
