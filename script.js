// Global Error Handling
window.onerror = function (message, source, lineno, colno, error) {
    console.error("An unhandled error occurred:", message, lineno);
    return true;
};

window.addEventListener('unhandledrejection', function (event) {
    console.error("An unhandled promise rejection occurred:", event.reason);
    event.preventDefault();
});

// Supabase Configuration
const SUPABASE_URL = 'https://aleedtftiuzbevczcfpr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZWVkdGZ0aXV6YmV2Y3pjZnByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDEwOTgsImV4cCI6MjA4NzQxNzA5OH0.wJgG58CqEs3Gf0sD25ThEYdOjFJtfE-BeOe2Ae8ZOQs';

// Initialize Supabase Client
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Helper for navigation, especially for file:// protocol
function navigateTo(path) {
    if (window.location.protocol === 'file:') {
        const currentPath = window.location.pathname;
        const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
        window.location.href = currentDir + '/' + path;
    } else {
        window.location.href = path;
    }
}

// State Management
let currentUser = null;
try {
    currentUser = localStorage.getItem('erp_current_user') || null;
} catch (e) {
    console.warn("localStorage is not available.");
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
}

function getCurrentDateString() {
    return new Date().toISOString().split('T')[0];
}

// Roll over any tasks past due that are not Completed...
async function rollOverTasksIfNeeded() {
    if (!supabase) return;
    const todayStr = getCurrentDateString();

    const { data: tasksToUpdate } = await supabase
        .from('tasks')
        .select('id, due_date')
        .neq('status', 'Completed')
        .lt('due_date', todayStr);

    if (tasksToUpdate && tasksToUpdate.length > 0) {
        for (const t of tasksToUpdate) {
            await supabase
                .from('tasks')
                .update({ due_date: todayStr })
                .eq('id', t.id);
        }
    }
}

// ============================================
// LOGIN PAGE LOGIC
// ============================================
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();

        if (username) {
            try { localStorage.setItem('erp_current_user', username); } catch (err) { }
            navigateTo('dashboard.html');
        }
    });

    if (currentUser) {
        navigateTo('dashboard.html');
    }
}

// ============================================
// DASHBOARD PAGE LOGIC
// ============================================
if (document.getElementById('display-name')) {
    if (!currentUser) {
        navigateTo('index.html');
    }

    document.getElementById('display-name').textContent = `Welcome, ${currentUser}`;

    document.getElementById('nav-create-btn').addEventListener('click', () => {
        navigateTo('create_task.html');
    });

    async function loadAndRenderTasks() {
        const tbody = document.getElementById('tasks-body');

        if (!supabase) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Supabase failed to load. Check console.</td></tr>';
            return;
        }

        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Loading tasks from Supabase...</td></tr>';

        await rollOverTasksIfNeeded();

        // Safely query name or assigned_by for the current user.
        // PostgREST string quoting handles spaces in names.
        const encodedUser = currentUser.replace(/"/g, '""');
        const filterStr = `name.eq."${encodedUser}",assigned_by.eq."${encodedUser}"`;

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .or(filterStr)
            .order('due_date', { ascending: true });

        if (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Error loading tasks.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        const todayStr = getCurrentDateString();

        if (tasks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No tasks found. Click "Create Task" to get started!</td></tr>';
        }

        tasks.forEach(task => {
            const tr = document.createElement('tr');

            const isDueToday = task.due_date === todayStr;
            const dueClass = isDueToday ? 'due-today-text' : '';
            const status = task.status || 'Active';

            tr.innerHTML = `
                <td>${task.name}</td>
                <td><strong>${task.title}</strong></td>
                <td>${formatDate(task.created_date)}</td>
                <td class="${dueClass}">${formatDate(task.due_date)}</td>
                <td>${task.assigned_by}</td>
                <td>
                    <div class="status-col">
                        <select class="status-select" data-id="${task.id}" data-prev="${status}" data-val="${status}">
                            <option value="Active" ${status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="Inprogress" ${status === 'Inprogress' ? 'selected' : ''}>Inprogress</option>
                            <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                </td>
                <td>${task.comments || '-'}</td>
                <td>${formatDate(task.completed_date)}</td>
                <td>
                    <button class="icon-btn desc-btn" data-desc="${escape(task.description || '')}">📄</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        attachDashboardEvents();
    }

    function attachDashboardEvents() {
        const selects = document.querySelectorAll('.status-select');
        selects.forEach(select => {
            select.addEventListener('change', async function () {
                const taskId = this.getAttribute('data-id');
                const prevStatus = this.getAttribute('data-prev');
                const newStatus = this.value;

                if (newStatus === 'Completed') {
                    const confirmComplete = confirm("Are you sure you want to mark this task as Completed?");
                    if (!confirmComplete) {
                        this.value = prevStatus;
                        return;
                    }
                }

                this.setAttribute('data-val', newStatus);

                const updateData = {
                    status: newStatus,
                    completed_date: newStatus === 'Completed' ? getCurrentDateString() : null
                };

                this.setAttribute('data-prev', newStatus);
                this.disabled = true;

                const { error } = await supabase
                    .from('tasks')
                    .update(updateData)
                    .eq('id', taskId);

                this.disabled = false;

                if (error) {
                    alert('Error updating status: ' + error.message);
                    this.value = prevStatus;
                    this.setAttribute('data-val', prevStatus);
                    this.setAttribute('data-prev', prevStatus);
                } else {
                    loadAndRenderTasks();
                }
            });
        });

        const descBtns = document.querySelectorAll('.desc-btn');
        const modal = document.getElementById('details-modal');
        const modalClose = document.getElementById('close-modal');
        const modalText = document.getElementById('modal-desc-text');

        descBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                modalText.innerText = unescape(this.getAttribute('data-desc'));
                modal.classList.add('active');
            });
        });

        modalClose.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    loadAndRenderTasks();
}

// ============================================
// CREATE TASK PAGE LOGIC
// ============================================
if (document.getElementById('create-task-form')) {
    if (!currentUser) {
        navigateTo('index.html');
    }

    document.getElementById('nav-back-btn').addEventListener('click', () => {
        navigateTo('dashboard.html');
    });

    document.getElementById('create-task-form').addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!supabase) {
            alert("Supabase SDK did not load. Please check your internet connection.");
            return;
        }

        const title = document.getElementById('task-title').value.trim();
        const desc = document.getElementById('task-desc').value.trim();
        const dueDate = document.getElementById('due-date').value;
        const assignToInput = document.getElementById('assign-to').value.trim();
        const comments = document.getElementById('comments').value.trim();
        const isRepeat = document.getElementById('repeat-work').checked;

        const assignedTo = assignToInput ? assignToInput : currentUser;

        function createTaskObj(dateStr) {
            return {
                name: assignedTo,
                title: title,
                description: desc,
                created_date: getCurrentDateString(),
                due_date: dateStr,
                assigned_by: currentUser,
                status: 'Active',
                comments: comments || null
            };
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        const tasksToInsert = [];

        if (isRepeat) {
            const selectedDate = new Date(dueDate);
            const dayOfWeek = selectedDate.getDay() || 7;
            const diffToMonday = selectedDate.getDate() - dayOfWeek + 1;

            const mondayDate = new Date(selectedDate);
            mondayDate.setDate(diffToMonday);

            for (let i = 0; i < 6; i++) {
                const targetDate = new Date(mondayDate);
                targetDate.setDate(mondayDate.getDate() + i);
                const dateStr = targetDate.toISOString().split('T')[0];
                tasksToInsert.push(createTaskObj(dateStr));
            }
        } else {
            tasksToInsert.push(createTaskObj(dueDate));
        }

        const { error } = await supabase.from('tasks').insert(tasksToInsert);

        if (error) {
            alert("Failed to insert tasks: " + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Task(s)';
        } else {
            navigateTo('dashboard.html');
        }
    });
}
