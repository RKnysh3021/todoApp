const taskForm = document.querySelector("#task-form");
const titleInput = document.querySelector("#title");
const descriptionInput = document.querySelector("#description");
const priorityInput = document.querySelector("#priority");
const dueDateInput = document.querySelector("#due-date");
const formMessage = document.querySelector("#form-message");
const listMessage = document.querySelector("#list-message");
const taskList = document.querySelector("#task-list");
const statusFilter = document.querySelector("#status-filter");
const priorityFilter = document.querySelector("#priority-filter");
const searchInput = document.querySelector("#search-input");
const sortBySelect = document.querySelector("#sort-by");
const sortOrderSelect = document.querySelector("#sort-order");
const refreshButton = document.querySelector("#refresh-button");
const clearCompletedButton = document.querySelector("#clear-completed-button");
const template = document.querySelector("#task-card-template");

const totalCount = document.querySelector("#total-count");
const activeCount = document.querySelector("#active-count");
const completedCount = document.querySelector("#completed-count");

const priorityLabels = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

let tasks = [];
let searchTimeoutId = null;

function setMessage(target, text, type = "") {
  target.textContent = text;
  target.className = target.id === "form-message" ? "form-message" : "list-message";
  if (type) {
    target.classList.add(type);
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDueDate(value) {
  if (!value) {
    return "Без дедлайна";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function updateStats() {
  const completed = tasks.filter((task) => task.is_completed).length;
  totalCount.textContent = String(tasks.length);
  completedCount.textContent = String(completed);
  activeCount.textContent = String(tasks.length - completed);
}

function getQueryString() {
  const params = new URLSearchParams();

  if (statusFilter.value === "active") {
    params.set("is_completed", "false");
  } else if (statusFilter.value === "completed") {
    params.set("is_completed", "true");
  }

  if (priorityFilter.value !== "all") {
    params.set("priority", priorityFilter.value);
  }

  const search = searchInput.value.trim();
  if (search) {
    params.set("search", search);
  }

  params.set("sort_by", sortBySelect.value);
  params.set("order", sortOrderSelect.value);

  return params.toString();
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Произошла ошибка";
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch (error) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function createEmptyState() {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "Под текущие фильтры задачи не найдены. Попробуйте изменить поиск или добавить новую задачу.";
  return empty;
}

function renderTasks() {
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    taskList.appendChild(createEmptyState());
    return;
  }

  tasks.forEach((task) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".task-card");
    const checkbox = fragment.querySelector(".task-completed");
    const priorityBadge = fragment.querySelector(".task-priority-badge");
    const dateNode = fragment.querySelector(".task-date");
    const createdDateNode = fragment.querySelector(".created-date");
    const dueDateNode = fragment.querySelector(".due-date");
    const form = fragment.querySelector(".task-edit-form");
    const titleField = fragment.querySelector(".task-title-input");
    const descriptionField = fragment.querySelector(".task-description-input");
    const priorityField = fragment.querySelector(".task-priority-input");
    const dueDateField = fragment.querySelector(".task-due-date-input");
    const deleteButton = fragment.querySelector(".delete-button");
    const saveButton = fragment.querySelector(".save-button");

    card.dataset.taskId = String(task.id);
    card.classList.toggle("completed", task.is_completed);
    card.dataset.priority = task.priority;

    checkbox.checked = task.is_completed;
    priorityBadge.textContent = priorityLabels[task.priority] || task.priority;
    priorityBadge.classList.add(`priority-${task.priority}`);
    dateNode.textContent = task.due_date ? `Дедлайн: ${formatDueDate(task.due_date)}` : "Без срока";
    createdDateNode.textContent = `Создано: ${formatDate(task.created_at)}`;
    dueDateNode.textContent = task.due_date ? `Нужно до: ${formatDueDate(task.due_date)}` : "Дедлайн не задан";
    titleField.value = task.title;
    descriptionField.value = task.description || "";
    priorityField.value = task.priority;
    dueDateField.value = task.due_date || "";

    checkbox.addEventListener("change", async () => {
      checkbox.disabled = true;
      try {
        await updateTask(task.id, { is_completed: checkbox.checked }, "Статус обновлен");
      } finally {
        checkbox.disabled = false;
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      saveButton.disabled = true;
      try {
        await updateTask(
          task.id,
          {
            title: titleField.value.trim(),
            description: descriptionField.value.trim() || null,
            priority: priorityField.value,
            due_date: dueDateField.value || null,
            is_completed: checkbox.checked,
          },
          "Задача сохранена"
        );
      } finally {
        saveButton.disabled = false;
      }
    });

    deleteButton.addEventListener("click", async () => {
      const isConfirmed = window.confirm(`Удалить задачу "${task.title}"?`);
      if (!isConfirmed) {
        return;
      }

      deleteButton.disabled = true;
      try {
        await request(`/tasks/${task.id}`, { method: "DELETE" });
        await loadTasks("Задача удалена");
      } catch (error) {
        setMessage(listMessage, error.message, "error");
      } finally {
        deleteButton.disabled = false;
      }
    });

    taskList.appendChild(fragment);
  });
}

async function loadTasks(successMessage = "") {
  setMessage(listMessage, "Загружаем задачи...");
  try {
    const query = getQueryString();
    const url = query ? `/tasks/?${query}` : "/tasks/";
    tasks = await request(url);
    updateStats();
    renderTasks();
    setMessage(listMessage, successMessage || `Загружено задач: ${tasks.length}`, "success");
  } catch (error) {
    setMessage(listMessage, error.message, "error");
  }
}

async function updateTask(id, payload, successMessage) {
  try {
    await request(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    await loadTasks(successMessage);
  } catch (error) {
    setMessage(listMessage, error.message, "error");
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title) {
    setMessage(formMessage, "Введите название задачи", "error");
    return;
  }

  const submitButton = taskForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    await request("/tasks/", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: description || null,
        priority: priorityInput.value,
        due_date: dueDateInput.value || null,
      }),
    });

    taskForm.reset();
    priorityInput.value = "medium";
    await loadTasks("Задача успешно добавлена");
    setMessage(formMessage, "Задача успешно добавлена", "success");
    titleInput.focus();
  } catch (error) {
    setMessage(formMessage, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

function handleFiltersChange() {
  void loadTasks();
}

statusFilter.addEventListener("change", handleFiltersChange);
priorityFilter.addEventListener("change", handleFiltersChange);
sortBySelect.addEventListener("change", handleFiltersChange);
sortOrderSelect.addEventListener("change", handleFiltersChange);

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimeoutId);
  searchTimeoutId = window.setTimeout(() => {
    void loadTasks();
  }, 250);
});

refreshButton.addEventListener("click", () => {
  void loadTasks("Список обновлен");
});

clearCompletedButton.addEventListener("click", async () => {
  clearCompletedButton.disabled = true;
  try {
    const result = await request("/tasks/completed", { method: "DELETE" });
    await loadTasks(`Удалено выполненных задач: ${result.deleted}`);
  } catch (error) {
    setMessage(listMessage, error.message, "error");
  } finally {
    clearCompletedButton.disabled = false;
  }
});

void loadTasks();
