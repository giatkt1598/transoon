import express from "express";

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/translate", (req, res) => {
  const { text } = req.body;

  // Fake translate
  res.json({
    input: text,
    output: `Translated: ${text}`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
