export async function markPaid(id: string) {
  await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({ where: { id }, data: { status: 'paid' } });
    await fetch('https://erp.example.com/orders', { method: 'POST', body: JSON.stringify(o) }); // expect: network-call-in-transaction
    await axios.post('https://hooks.example.com', o); // expect: network-call-in-transaction
    await stripe.refunds.create({ charge: o.chargeId }); // expect: network-call-in-transaction
    for (const line of o.lines) {
      await transporter.sendMail({ to: line.email, subject: 'paid' }); // expect: network-call-in-transaction
    }
  });
}

export async function summarize(docId: string) {
  await db.transaction(async (trx) => {
    const doc = await trx.selectFrom('docs').where('id', '=', docId).executeTakeFirstOrThrow();
    const r = await openai.chat.completions.create({ model: 'x', messages: [] }); // expect: network-call-in-transaction
    await trx.updateTable('docs').set({ summary: r.choices[0].message.content }).execute();
  });
}
