app.post('/signup', async (req, res) => {
  const u = await createUser(req.body);
  sendWelcomeEmail(u);
  res.json(u);
});
