
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3000;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors({
  origin: [
    "https://jehu-chart.onrender.com"
  ]
}));

app.use(express.json({ limit: "10mb" }));
// Supabase connection test
app.get("/api/supabase-status", async (req, res) => {
  try {
    const { error } = await supabase
      .from("jehu_profiles")
      .select("id")
      .limit(1);

    if (error) {
      throw error;
    }

    res.json({
      connected: true,
      message: "Jehu AI Brain is connected to Supabase."
    });

  } catch (error) {
    console.error("Supabase connection error:", error.message);

    res.status(500).json({
      connected: false,
      message: "Supabase connection failed."
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "Jehu AI Brain",
    status: "online",
    message: "Jehu AI backend is running!"
  });
});

// AI status
app.get("/api/status", (req, res) => {
  res.json({
    backend: "online",
    memory: "awaiting connection",
    knowledge: "awaiting connection",
    aiModel: "not connected"
  });
});

// Initial chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "Please enter a message."
    });
  }

  res.json({
    answer:
      "Jehu AI Brain received your message: " +
      message +
      ". The backend is working, but its language model has not been connected yet.",
    mode: "backend-test"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jehu AI Brain running on port ${PORT}`);
});
