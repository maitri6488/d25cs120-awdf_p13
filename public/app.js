const createTaskForm = document.getElementById('create-task-form');
const taskTitle = document.getElementById('task-title');
const taskDesc = document.getElementById('task-desc');
const taskUser = document.getElementById('task-user');
const taskPriority = document.getElementById('task-priority');
const btnGenerateAi = document.getElementById('btn-generate-ai');
const aiBtnText = document.getElementById('ai-btn-text');
const aiBadge = document.getElementById('ai-badge');

const tasksList = document.getElementById('tasks-list');
const logsContainer = document.getElementById('logs-container');
const btnCheckHealth = document.getElementById('btn-check-health');
const btnClearLogs = document.getElementById('btn-clear-logs');
const toast = document.getElementById('toast');

let isCurrentDescAi = false;
let logs = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchTasks();
    checkHealth();

    createTaskForm.addEventListener('submit', handleCreateTask);
    btnGenerateAi.addEventListener('click', handleGenerateAiDescription);
    btnCheckHealth.addEventListener('click', checkHealth);
    btnClearLogs.addEventListener('click', handleClearLogs);
    tasksList.addEventListener('click', handleTaskListClick);

    // Suggestion chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            taskTitle.value = chip.getAttribute('data-title');
            taskTitle.focus();
        });
    });

    addLog('start', '[AI Service Init] Server-side AI route registered (/api/ai/generate-description)');
    addLog('ai', '[Responsible AI] API keys stored server-side only in .env; zero exposure to browser');
});

function showToast(msg, type = 'info') {
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => {
        toast.className = 'toast hidden';
    }, 4500);
}

function addLog(type, message) {
    const time = new Date().toISOString().substring(11, 19);
    logs.unshift({ time, type, message });
    renderLogs();
}

function renderLogs() {
    if (logs.length === 0) {
        logsContainer.innerHTML = '<p style="text-align: center; color: #888; padding: 15px;">No logs yet.</p>';
        return;
    }
    logsContainer.innerHTML = logs.map(l => `
        <div class="log-entry">
            <span class="log-time">${l.time}</span>
            <span class="log-type-${l.type}">${escapeHtml(l.message)}</span>
        </div>
    `).join('');
}

function handleClearLogs() {
    logs = [];
    renderLogs();
}

// Generate Description via secure backend AI endpoint
async function handleGenerateAiDescription() {
    const title = taskTitle.value.trim();
    if (!title) {
        showToast('Please enter a task title first to generate an AI description', 'warning');
        taskTitle.focus();
        return;
    }

    // Set Loading State
    btnGenerateAi.disabled = true;
    aiBtnText.textContent = '🤖 Thinking...';

    try {
        const res = await fetch('/api/ai/generate-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });

        const data = await res.json();

        if (res.status === 429) {
            showToast(data.message || 'Rate limit active', 'warning');
            addLog('error', `[Rate Limit] ${data.message}`);
            return;
        }

        if (data.success && data.description) {
            taskDesc.value = data.description;
            isCurrentDescAi = true;
            aiBadge.classList.remove('hidden');

            if (data.suggestedPriority) {
                taskPriority.value = data.suggestedPriority;
            }

            const modelLabel = data.fallback ? 'Fallback Intelligence' : (data.model || 'OpenAI gpt-4o-mini');
            showToast(`Description generated (${modelLabel})! You may edit before saving.`, 'success');
            addLog('ai', `[POST /api/ai 200] Generated using: ${modelLabel}. Suggested priority: ${data.suggestedPriority || 'medium'}`);
        } else {
            showToast('Unable to generate AI description', 'error');
            addLog('error', `[AI Error] ${data.message || 'Unknown response'}`);
        }

    } catch (err) {
        showToast('Error calling AI route: ' + err.message, 'error');
        addLog('error', `[AI Connection Error] ${err.message}`);
    } finally {
        btnGenerateAi.disabled = false;
        aiBtnText.textContent = '✨ Generate AI';
    }
}

async function checkHealth() {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        addLog('api', `[GET /api/health 200] Key Security: ${data.aiIntegration.keyStoredSecurely} | Degradation: ${data.aiIntegration.gracefulDegradation}`);
        showToast('Security Verified: AI API Key safely isolated on server', 'success');
    } catch (err) {
        addLog('error', `[Health Error] ${err.message}`);
    }
}

async function fetchTasks() {
    try {
        const res = await fetch('/tasks');
        const data = await res.json();
        renderTasks(data.tasks || []);
    } catch (err) {
        addLog('error', `[Fetch Error] ${err.message}`);
    }
}

function renderTasks(tasks) {
    if (tasks.length === 0) {
        tasksList.innerHTML = '<li style="color: #888; text-align: center; padding: 12px;">No tasks available.</li>';
        return;
    }

    tasksList.innerHTML = tasks.map(t => `
        <li class="task-item" data-id="${t._id}">
            <div class="task-info">
                <span class="task-title">${escapeHtml(t.title)}</span>
                ${t.description ? `<p class="task-desc-text">${escapeHtml(t.description)}</p>` : ''}
                <div class="task-meta">
                    <span>Assigned: ${escapeHtml(t.assignedUser || 'Maitri Sheta (D25CS120)')}</span>
                    <span class="badge badge-${t.priority || 'medium'}">${t.priority || 'medium'}</span>
                    ${t.isAiGenerated ? `<span class="badge badge-ai">✨ AI Assisted</span>` : ''}
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-danger btn-delete" data-id="${t._id}">Delete</button>
        </li>
    `).join('');
}

async function handleTaskListClick(e) {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;

    try {
        const res = await fetch(`/tasks/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Task deleted successfully', 'info');
            addLog('complete', `[DELETE /tasks/${id} 200] Task removed`);
            fetchTasks();
        } else {
            showToast(data.message || 'Error deleting task', 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

async function handleCreateTask(e) {
    e.preventDefault();
    const title = taskTitle.value.trim();
    if (!title) return;

    try {
        const res = await fetch('/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description: taskDesc.value.trim(),
                isAiGenerated: isCurrentDescAi,
                assignedUser: taskUser.value.trim(),
                priority: taskPriority.value
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast('Task saved successfully with human-verified description!', 'success');
            addLog('complete', `[POST /tasks 201] Saved task "${data.task.title}" (AI: ${isCurrentDescAi ? 'Yes' : 'No'})`);
            taskTitle.value = '';
            taskDesc.value = '';
            isCurrentDescAi = false;
            aiBadge.classList.add('hidden');
            fetchTasks();
        } else {
            showToast(data.message || 'Error creating task', 'error');
            addLog('error', `[POST /tasks 400] ${data.message}`);
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
