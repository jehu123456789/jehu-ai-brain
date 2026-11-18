

import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Paystack configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Fixed prices (amounts in kobo)
const JEHU_PRICES = {
  premium: {
    amount: 100000,
    currency: "NGN",
    durationDays: 30
  },

  marketplace: {
    amount: 50000,
    currency: "NGN",
    durationDays: 14
  }
};

// Middleware
app.use(cors({
  origin: [
    "https://jehu-chart.onrender.com"
  ]
}));

app.use(express.json({ limit: "10mb" }));

// Verify signed-in JehuApp user
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Please sign in first."
      });
    }

    const token = authHeader.slice(7);

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        error: "Your session is invalid. Please sign in again."
      });
    }

    req.jehuUser = data.user;
    next();

  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(500).json({
      error: "Authentication failed."
    });
  }
}

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

// Test Supabase connection
app.get("/api/supabase-status", async (req, res) => {
  try {
    const { error } = await supabase
      .from("jehu_profiles")
      .select("id")
      .limit(1);

    if (error) throw error;

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

// Initialize Paystack payment
app.post(
  "/api/payments/initialize",
  authenticateUser,
  async (req, res) => {
    try {
      if (!PAYSTACK_SECRET_KEY) {
        return res.status(503).json({
          error: "Payment service is not configured yet."
        });
      }

      const { purchaseType } = req.body || {};
      const price = JEHU_PRICES[purchaseType];

      if (!price) {
        return res.status(400).json({
          error: "Invalid purchase type."
        });
      }

      const email = req.jehuUser.email;

      if (!email) {
        return res.status(400).json({
          error: "Your account needs an email address."
        });
      }

      const response = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            amount: price.amount,
            currency: price.currency,
            metadata: {
              user_id: req.jehuUser.id,
              purchase_type: purchaseType,
              duration_days: price.durationDays
            }
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.status || !result.data) {
        console.error("Paystack initialization failed.");

        return res.status(502).json({
          error: "Could not start payment. Please try again."
        });
      }

      res.json({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference
      });

    } catch (error) {
      console.error("Payment initialization error:", error.message);

      res.status(500).json({
        error: "Payment could not be started."
      });
    }
  }
);

// Verify Paystack payment
app.get(
  "/api/payments/verify/:reference",
  authenticateUser,
  async (req, res) => {
    try {
      if (!PAYSTACK_SECRET_KEY) {
        return res.status(503).json({
          error: "Payment service is not configured."
        });
      }

      const reference = req.params.reference;

      if (
        typeof reference !== "string" ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(reference)
      ) {
        return res.status(400).json({
          error: "Invalid payment reference."
        });
      }

      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.status || !result.data) {
        return res.status(400).json({
          error: "Payment verification failed."
        });
      }

      const payment = result.data;
      const metadata = payment.metadata || {};
      const price = JEHU_PRICES[metadata.purchase_type];

      // Confirm the payment belongs to this signed-in user
      if (
        payment.status !== "success" ||
        payment.currency !== "NGN" ||
        payment.customer?.email !== req.jehuUser.email ||
        metadata.user_id !== req.jehuUser.id ||
        !price ||
        payment.amount !== price.amount
      ) {
        return res.status(400).json({
          error: "Payment details could not be confirmed."
        });
      }

      res.json({
        verified: true,
        reference: payment.reference,
        purchaseType: metadata.purchase_type,
        message: "Payment verified successfully."
      });

    } catch (error) {
      console.error("Payment verification error:", error.message);

      res.status(500).json({
        error: "Could not verify payment."
      });
    }
  }
);

// Initial AI chat endpoint
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

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jehu AI Brain running on port ${PORT}`);
});
