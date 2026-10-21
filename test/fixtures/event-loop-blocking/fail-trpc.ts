import { readFileSync } from 'node:fs';

export const reportRouter = router({
  download: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const pdf = readFileSync(`/data/reports/${input.id}.pdf`); // expect: event-loop-blocking
    return pdf.toString('base64');
  }),
});
