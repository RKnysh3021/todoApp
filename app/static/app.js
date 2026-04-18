const taskForm = document.querySelector("#task-form");
const titleInput = document.querySelector("#title");
const descriptionInput = document.querySelector("#description");
const formMessage = document.querySelector("#form-message");
const listMessage = document.querySelector("#list-message");
const taskList = document.querySelector("#task-list");
const filterSelect = document.querySelector("#status-filter");
const refreshButton = document.querySelector("#refresh-button");
const template = document.querySelector("#task-card-template");

const totalCount = document.querySelector("#total-count");
const activeCount = document.querySelector("#active-count");
const completedCount = document.querySelector("#completed-count");

let tasks = [];

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

function updateStats() {
  const completed = tasks.filter((task) => task.is_completed).length;
  totalCount.textContent = String(tasks.length);
  completedCount.textContent = String(completed);
  activeCount.textContent = String(tasks.length - completed);
}

function filteredTasks() {
  const filter = filterSelect.value;

  if (filter === "active") {
    return tasks.filter((task) => !task.is_completed);
  }

  if (filter === "completed") {
    return tasks.filter((task) => task.is_completed);
  }

  return tasks;
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
  empty.textContent = "Задач пока нет. Добавьте первую задачу через форму слева.";
  return empty;
}

function renderTasks() {
  taskList.innerHTML = "";
  const visibleTasks = filteredTasks();

  if (visibleTasks.length === 0) {
    taskList.appendChild(createEmptyState());
    return;
  }

  visibleTasks.forEach((task) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".task-card");
    const checkbox = fragment.querySelector(".task-completed");
    const dateNode = fragment.querySelector(".task-date");
    const form = fragment.querySelector(".task-edit-form");
    const titleField = fragment.querySelector(".task-title-input");
    const descriptionField = fragment.querySelector(".task-description-input");
    const deleteButton = fragment.querySelector(".delete-button");
    const saveButton = fragment.querySelector(".save-button");

    card.dataset.taskId = String(task.id);
    card.classList.toggle("completed", task.is_completed);
    checkbox.checked = task.is_completed;
    dateNode.textContent = `Создано: ${formatDate(task.created_at)}`;
    titleField.value = task.title;
    descriptionField.value = task.description || "";

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
        tasks = tasks.filter((item) => item.id !== task.id);
        updateStats();
        renderTasks();
        setMessage(listMessage, "Задача удалена", "success");
      } catch (error) {
        setMessage(listMessage, error.message, "error");
      } finally {
        deleteButton.disabled = false;
      }
    });

    taskList.appendChild(fragment);
  });
}

async function loadTasks() {
  setMessage(listMessage, "Загружаем задачи...");
  try {
    tasks = await request("/tasks/");
    updateStats();
    renderTasks();
    setMessage(listMessage, `Загружено задач: ${tasks.length}`, "success");
  } catch (error) {
    setMessage(listMessage, error.message, "error");
  }
}

async function updateTask(id, payload, successMessage) {
  try {
    const updatedTask = await request(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    tasks = tasks.map((task) => (task.id === id ? updatedTask : task));
    updateStats();
    renderTasks();
    setMessage(listMessage, successMessage, "success");
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
    const newTask = await request("/tasks/", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: description || null,
      }),
    });

    tasks = [newTask, ...tasks].sort((left, right) => left.id - right.id);
    taskForm.reset();
    updateStats();
    renderTasks();
    setMessage(formMessage, "Задача успешно добавлена", "success");
    setMessage(listMessage, "Список обновлен", "success");
    titleInput.focus();
  } catch (error) {
    setMessage(formMessage, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

filterSelect.addEventListener("change", renderTasks);
refreshButton.addEventListener("click", loadTasks);

loadTasks();
