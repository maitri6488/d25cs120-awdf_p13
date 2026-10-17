const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Task = require('../models/Task');

let fallbackTasks = [
  { _id: '66fa01b123456789abcdef01', title: 'Implement Secure AI Route (/api/ai/generate-description)', description: 'Ensure API keys are isolated on server-side and never exposed to React client.', isAiGenerated: true, priority: 'high', assignedUser: 'Maitri Sheta (D25CS120)', completed: true, createdAt: new Date() },
  { _id: '66fa01b123456789abcdef02', title: 'Verify Graceful Degradation on Invalid API Key', description: 'Test offline fallback handling so the task creation flow never crashes.', isAiGenerated: false, priority: 'medium', assignedUser: 'Maitri Sheta (D25CS120)', completed: false, createdAt: new Date() }
];

async function getTasksFromDatabase() {
  if (mongoose.connection.readyState === 1) {
    return await Task.find().sort({ createdAt: -1 });
  }
  return fallbackTasks;
}

// GET /tasks - List all tasks
router.get('/', async (req, res, next) => {
  try {
    const tasks = await getTasksFromDatabase();
    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (err) {
    next(err);
  }
});

// POST /tasks - Create a task
router.post('/', async (req, res, next) => {
  try {
    const { title, description, priority, assignedUser, isAiGenerated } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }

    let savedTask;
    if (mongoose.connection.readyState === 1) {
      const newTask = new Task({
        title: title.trim(),
        description: description || '',
        priority: priority || 'medium',
        isAiGenerated: Boolean(isAiGenerated),
        assignedUser: assignedUser || 'Maitri Sheta (D25CS120)'
      });
      savedTask = await newTask.save();
    } else {
      savedTask = {
        _id: 'temp_' + Date.now(),
        title: title.trim(),
        description: description || '',
        priority: priority || 'medium',
        isAiGenerated: Boolean(isAiGenerated),
        assignedUser: assignedUser || 'Maitri Sheta (D25CS120)',
        completed: false,
        createdAt: new Date()
      };
      fallbackTasks.unshift(savedTask);
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: savedTask
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id - Delete a task
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    let deletedTask;

    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(id)) {
      deletedTask = await Task.findByIdAndDelete(id);
    } else {
      const index = fallbackTasks.findIndex(t => t._id.toString() === id);
      if (index !== -1) {
        deletedTask = fallbackTasks.splice(index, 1)[0];
      }
    }

    if (!deletedTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      task: deletedTask
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
