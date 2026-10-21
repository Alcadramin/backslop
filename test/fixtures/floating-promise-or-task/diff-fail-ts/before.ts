app.post('/signup', async (req, res) => {
  const u = await createUser(req.body);
  await sendWelcomeEmail(u);
  res.json(u);
});
