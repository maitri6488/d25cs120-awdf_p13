const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const taskRoutes = require('./routes/taskRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskdb_ai';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend UI matching Practical 10/11/12 design
app.use(express.static(path.join(__dirname, 'public')));

// Health & AI Security Diagnostic Endpoint
app.get('/api/health', (req, res) => {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-'));
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  res.status(200).json({
    status: 'healthy',
    service: 'practical-13-ai-integration',
    student: 'Maitri Sheta',
    studentId: 'D25CS120',
    aiIntegration: {
      keyConfigured: hasOpenAiKey || hasGeminiKey,
      keyStoredSecurely: 'Server-side (.env only)',
      gracefulDegradation: 'Active (Fallback Generator Enabled)',
      rateLimiter: 'Active (5s cooldown per task)'
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'in-memory-fallback'
    }
  });
});

// Mount Routes
app.use('/tasks', taskRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database & Server Startup
if (require.main === module) {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log(`✔ Connected to MongoDB: ${MONGO_URI}`);
      app.listen(PORT, () => {
        console.log(`✔ Practical 13 AI Server running at http://localhost:${PORT}`);
        console.log(`✔ Student: Maitri Sheta (ID: D25CS120)`);
      });
    })
    .catch((err) => {
      console.warn(`MongoDB offline (${err.message}). Running in in-memory fallback mode.`);
      app.listen(PORT, () => {
        console.log(`✔ Practical 13 AI Server running at http://localhost:${PORT} (fallback mode)`);
        console.log(`✔ Student: Maitri Sheta (ID: D25CS120)`);
      });
    });
}

module.exports = app;
