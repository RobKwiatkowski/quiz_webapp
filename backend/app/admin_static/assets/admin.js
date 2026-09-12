const DEFAULT_SUBJECT_ID = "history";

let subjects = [];
let chapters = [];
let topics = [];
let questions = [];
let selectedSubject = null;
let selectedChapter = null;
let selectedTopic = null;
let editingQuestionId = null;
let imagePreviewObjectUrl = "";

const chapterPanel = document.getElementById("chapter-panel");
const topicPanel = document.getElementById("topic-panel");
const questionPanel = document.getElementById("question-panel");
const chapterList = document.getElementById("chapter-list");
const topicList = document.getElementById("topic-list");
const questionList = document.getElementById("question-list");
const editorPanel = document.getElementById("editor-panel");
const questionForm = document.getElementById("question-form");
const questionType = document.getElementById("question-type");
const formError = document.getElementById("form-error");
const MAP_SOURCE_PRESETS = {
  "/static/maps/ancient-civilizations-regions.geojson": {
    mode: "select",
    backgroundSource: "/static/maps/ancient-civilizations-basemap.geojson"
  },
  "/static/maps/poland-voivodeships.geojson": {mode: "select", backgroundSource: ""},
  "/static/maps/world-continents.geojson": {mode: "identify", backgroundSource: ""}
};

async function adminFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    window.location.href = "/admin/login.html";
    throw new Error("Wymagane logowanie.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "Operacja nie powiodła się.");
  }

  return response.json();
}

function showStatus(message, isError = false) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
}

function hideStatus() {
  document.getElementById("status").classList.add("hidden");
}

async function initAdmin() {
  const session = await adminFetch("/api/admin/me");
  if (!session.authenticated) {
    window.location.href = "/admin/login.html";
    return;
  }

  document.getElementById("logout-button").addEventListener("click", logout);
  document.getElementById("add-chapter-button").addEventListener("click", addChapter);
  document.getElementById("add-topic-button").addEventListener("click", addTopic);
  document.getElementById("add-question-button").addEventListener("click", () => openEditor());
  document.getElementById("cancel-edit-button").addEventListener("click", closeEditor);
  document.getElementById("add-answer-button").addEventListener("click", () => addAnswerRow());
  document.getElementById("add-accepted-answer-button").addEventListener("click", () => addAcceptedAnswerRow());
  document.getElementById("add-slot-button").addEventListener("click", () => addSlotRow());
  document.getElementById("add-order-item-button").addEventListener("click", () => addOrderItemRow());
  document.getElementById("add-matching-pair-button").addEventListener("click", () => addMatchingPairRow());
  document.getElementById("image-url").addEventListener("input", handleImageUrlInput);
  document.getElementById("image-file").addEventListener("change", handleImageFileChange);
  document.getElementById("remove-image-button").addEventListener("click", clearSelectedImage);
  document.getElementById("image-dropzone").addEventListener("dragover", handleImageDragOver);
  document.getElementById("image-dropzone").addEventListener("dragleave", handleImageDragLeave);
  document.getElementById("image-dropzone").addEventListener("drop", handleImageDrop);
  document.getElementById("toggle-context-button").addEventListener("click", showContextField);
  document.getElementById("multi-slot-toggle").addEventListener("change", updateOpenEditorMode);
  document.getElementById("map-source").addEventListener("change", applyMapSourcePreset);
  document.getElementById("map-mode").addEventListener("change", updateEditorType);
  questionType.addEventListener("change", updateEditorType);
  questionForm.addEventListener("submit", saveQuestion);

  await loadSubjects();
  showChapterView();
}

function setPanels(viewName) {
  chapterPanel.classList.toggle("hidden", viewName !== "chapters");
  topicPanel.classList.toggle("hidden", viewName !== "topics");
  questionPanel.classList.toggle("hidden", viewName !== "questions");
  closeEditor();
  renderBreadcrumb(viewName);
}

function renderBreadcrumb(viewName) {
  const breadcrumb = document.getElementById("breadcrumb");
  breadcrumb.replaceChildren();
  addCrumb(getSelectedSubjectTitle(), showChapterView, viewName === "chapters");

  if (selectedChapter && (viewName === "topics" || viewName === "questions")) {
    addSeparator();
    addCrumb(selectedChapter.title, showTopicView, viewName === "topics");
  }

  if (selectedTopic && viewName === "questions") {
    addSeparator();
    addCrumb(selectedTopic.title, null, true);
  }
}

function addCrumb(label, onClick, isCurrent) {
  const breadcrumb = document.getElementById("breadcrumb");
  if (isCurrent || !onClick) {
    const span = document.createElement("span");
    span.textContent = label;
    span.setAttribute("aria-current", "page");
    breadcrumb.appendChild(span);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "link-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  breadcrumb.appendChild(button);
}

function addSeparator() {
  const separator = document.createElement("span");
  separator.textContent = "/";
  separator.className = "breadcrumb-separator";
  document.getElementById("breadcrumb").appendChild(separator);
}

async function loadChapters() {
  const subjectId = selectedSubject?.id || DEFAULT_SUBJECT_ID;
  chapters = await adminFetch(`/api/admin/chapters?subject=${encodeURIComponent(subjectId)}`);
  renderChapterList();
}

async function loadSubjects() {
  subjects = await adminFetch("/api/admin/subjects");
  selectedSubject = subjects.find((subject) => subject.id === DEFAULT_SUBJECT_ID) || subjects[0] || null;
  renderSubjectTabs();
  await loadChapters();
}

function renderSubjectTabs() {
  const tabsEl = document.getElementById("subject-tabs");
  tabsEl.replaceChildren();

  subjects.forEach((subject) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "subject-tab";
    button.textContent = subject.title;
    button.setAttribute("aria-pressed", subject.id === selectedSubject?.id ? "true" : "false");
    button.addEventListener("click", () => selectSubject(subject));
    tabsEl.appendChild(button);
  });
}

async function selectSubject(subject) {
  if (subject.id === selectedSubject?.id) return;
  selectedSubject = subject;
  selectedChapter = null;
  selectedTopic = null;
  topics = [];
  questions = [];
  hideStatus();
  renderSubjectTabs();
  await loadChapters();
  showChapterView();
}

function renderChapterList() {
  chapterList.replaceChildren();
  document.getElementById("chapter-empty").classList.toggle("hidden", chapters.length > 0);
  document.getElementById("chapter-panel-title").textContent = `Rozdziały: ${getSelectedSubjectTitle()}`;

  chapters.forEach((chapter) => {
    chapterList.appendChild(createItemButton(chapter.title, () => selectChapter(chapter)));
  });
}

async function selectChapter(chapter) {
  selectedChapter = chapter;
  selectedTopic = null;
  hideStatus();
  await loadTopics();
  showTopicView();
}

function showChapterView() {
  selectedChapter = null;
  selectedTopic = null;
  setPanels("chapters");
}

async function loadTopics() {
  if (!selectedChapter) return;
  topics = await adminFetch(`/api/admin/chapters/${selectedChapter.id}/topics`);
  renderTopicList();
}

function renderTopicList() {
  topicList.replaceChildren();
  document.getElementById("topic-panel-title").textContent = selectedChapter?.title || "Tematy";
  document.getElementById("topic-empty").classList.toggle("hidden", topics.length > 0);

  topics.forEach((topic) => {
    topicList.appendChild(createItemButton(topic.title, () => selectTopic(topic)));
  });
}

function showTopicView() {
  selectedTopic = null;
  setPanels("topics");
}

async function selectTopic(topic) {
  selectedTopic = topic;
  hideStatus();
  await loadQuestions();
  showQuestionView();
}

async function loadQuestions() {
  if (!selectedChapter || !selectedTopic) return;
  questions = await adminFetch(`/api/admin/chapters/${selectedChapter.id}/topics/${selectedTopic.id}/questions`);
  renderQuestionList();
}

function showQuestionView() {
  document.getElementById("question-panel-title").textContent = selectedTopic?.title || "Pytania";
  setPanels("questions");
}

function createItemButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function addChapter() {
  const name = prompt("Podaj nazwę rozdziału:");
  if (name === null) return;
  const trimmedName = name.trim();
  if (!trimmedName) {
    showStatus("Nazwa rozdziału nie może być pusta.", true);
    return;
  }

  const chapter = await adminFetch("/api/admin/chapters", {
    method: "POST",
    body: JSON.stringify({name: trimmedName, subject: selectedSubject?.id || DEFAULT_SUBJECT_ID})
  });
  await loadChapters();
  await selectChapter(chapter);
  showStatus("Dodano rozdział.");
}

function getSelectedSubjectTitle() {
  return selectedSubject?.title || "Przedmiot";
}

async function addTopic() {
  if (!selectedChapter) return;
  const name = prompt("Podaj nazwę tematu:");
  if (name === null) return;
  const trimmedName = name.trim();
  if (!trimmedName) {
    showStatus("Nazwa tematu nie może być pusta.", true);
    return;
  }

  const topic = await adminFetch(`/api/admin/chapters/${selectedChapter.id}/topics`, {
    method: "POST",
    body: JSON.stringify({name: trimmedName})
  });
  await loadTopics();
  await selectTopic(topic);
  showStatus("Dodano temat.");
}

function renderQuestionList() {
  questionList.replaceChildren();
  document.getElementById("question-empty").classList.toggle("hidden", questions.length > 0);
  questionList.classList.toggle("hidden", questions.length === 0);
  document.getElementById("question-count").textContent = formatQuestionCount(questions.length);

  questions.forEach((question, index) => {
    const itemEl = document.createElement("div");
    itemEl.className = "question-row";

    const numberEl = document.createElement("div");
    numberEl.className = "question-number";
    numberEl.textContent = `${index + 1}.`;

    const summaryEl = document.createElement("div");
    summaryEl.className = "question-text";
    summaryEl.textContent = question.text;

    const actionsEl = document.createElement("div");
    actionsEl.className = "question-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "secondary-button";
    editButton.textContent = "Edytuj";
    editButton.addEventListener("click", () => openEditor(question));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Usuń";
    deleteButton.addEventListener("click", () => deleteQuestion(question));

    actionsEl.append(editButton, deleteButton);
    itemEl.append(numberEl, summaryEl, actionsEl);
    questionList.appendChild(itemEl);
  });
}

function formatQuestionCount(count) {
  if (count === 1) return "1 pytanie";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} pytania`;
  }
  return `${count} pytań`;
}

function openEditor(question = null) {
  if (!selectedChapter || !selectedTopic) return;
  editingQuestionId = question ? question.id : null;
  document.getElementById("editor-title").textContent = question ? "Edytuj pytanie" : "Dodaj pytanie";
  document.getElementById("editor-subtitle").textContent = question
    ? "Zaktualizuj pytanie w wybranym temacie"
    : "Utwórz nowe pytanie w wybranym temacie";
  document.getElementById("save-question-button").textContent = question ? "Zapisz zmiany" : "Dodaj pytanie";
  questionForm.reset();
  formError.classList.add("hidden");
  document.getElementById("answer-rows").replaceChildren();
  document.getElementById("accepted-answer-rows").replaceChildren();
  document.getElementById("slot-rows").replaceChildren();
  document.getElementById("order-item-rows").replaceChildren();
  document.getElementById("matching-pair-rows").replaceChildren();
  document.getElementById("image-url").value = "";
  document.getElementById("image-file").value = "";
  document.getElementById("map-source").value = "/static/maps/ancient-civilizations-regions.geojson";
  document.getElementById("map-mode").value = "select";
  document.getElementById("map-target-feature-id").value = "";
  document.getElementById("map-background-source").value = "/static/maps/ancient-civilizations-basemap.geojson";
  hideContextField();
  updateImagePreview();

  if (question) {
    questionType.value = question.selection_type;
    document.getElementById("question-text").value = question.text || "";
    document.getElementById("question-explanation").value = question.explanation || "";
    document.getElementById("context-text").value = question.context?.text || question.source_text || "";
    if (document.getElementById("context-text").value.trim()) {
      showContextField();
    }
    document.getElementById("image-url").value = typeof question.image === "string" ? question.image : "";
    if (question.map_config) {
      document.getElementById("map-source").value = question.map_config.source || "";
      document.getElementById("map-mode").value = question.map_config.mode || "select";
      document.getElementById("map-target-feature-id").value = question.map_config.target_feature_id || "";
      document.getElementById("map-background-source").value = question.map_config.background_source || "";
    }
    updateImagePreview();

    (question.answers || []).forEach((answer) => addAnswerRow(answer));
    (question.accepted_answers || []).forEach((answer) => addAcceptedAnswerRow(answer));
    if ((question.answer_slots || []).length > 0) {
      document.getElementById("multi-slot-toggle").checked = true;
      question.answer_slots.forEach((slot) => addSlotRow(slot.accepted_answers || [""]));
    }
    [...(question.order_items || [])]
      .sort((a, b) => a.position - b.position)
      .forEach((item) => addOrderItemRow(item));
    (question.matching_pairs || []).forEach((pair) => addMatchingPairRow(pair));
  }

  if (document.getElementById("answer-rows").children.length === 0) {
    for (let i = 0; i < 4; i += 1) addAnswerRow();
  }

  if (document.getElementById("accepted-answer-rows").children.length === 0) {
    addAcceptedAnswerRow();
  }

  if (document.getElementById("slot-rows").children.length === 0) {
    addSlotRow([""]);
    addSlotRow([""]);
  }

  if (document.getElementById("order-item-rows").children.length === 0) {
    addOrderItemRow();
    addOrderItemRow();
    addOrderItemRow();
  }

  if (document.getElementById("matching-pair-rows").children.length === 0) {
    addMatchingPairRow();
    addMatchingPairRow();
  }

  updateEditorType();
  editorPanel.classList.remove("hidden");
  editorPanel.scrollIntoView({behavior: "smooth", block: "start"});
}

function closeEditor() {
  editingQuestionId = null;
  editorPanel.classList.add("hidden");
  formError.classList.add("hidden");
  clearImagePreviewObjectUrl();
}

function showContextField() {
  document.getElementById("context-field").classList.remove("hidden");
  document.getElementById("toggle-context-button").classList.add("hidden");
}

function hideContextField() {
  document.getElementById("context-field").classList.add("hidden");
  document.getElementById("toggle-context-button").classList.remove("hidden");
}

function updateEditorType() {
  const isOpen = questionType.value === "open";
  const isLlm = questionType.value === "llm";
  const isOrder = questionType.value === "order";
  const isMatching = questionType.value === "matching";
  const isMap = questionType.value === "map";
  const isMapIdentify = isMap && document.getElementById("map-mode").value === "identify";
  const isChoice = questionType.value === "single" || questionType.value === "multiple" || isMapIdentify;
  const supportsImage = questionType.value === "single" || questionType.value === "open";
  const isTextAnswer = isOpen || isLlm;
  document.getElementById("image-editor").classList.toggle("hidden", !supportsImage);
  document.getElementById("choice-editor").classList.toggle("hidden", !isChoice);
  document.getElementById("open-editor").classList.toggle("hidden", !isTextAnswer);
  document.getElementById("order-editor").classList.toggle("hidden", !isOrder);
  document.getElementById("matching-editor").classList.toggle("hidden", !isMatching);
  document.getElementById("map-editor").classList.toggle("hidden", !isMap);
  document.getElementById("multi-slot-toggle").closest("label").classList.toggle("hidden", isLlm);
  document.getElementById("accepted-answer-title").textContent = isLlm ? "Odpowiedź wzorcowa dla AI" : "Poprawne odpowiedzi";
  document.getElementById("explanation-label-text").textContent = isChoice && !isMap ? "Wyjaśnienie (opcjonalne)" : "Wyjaśnienie";
  updateAnswerControls();
  updateOpenEditorMode();
  updateOrderItemControls();
}

function applyMapSourcePreset() {
  const source = document.getElementById("map-source").value;
  const preset = MAP_SOURCE_PRESETS[source];
  if (!preset) return;

  document.getElementById("map-mode").value = preset.mode;
  document.getElementById("map-background-source").value = preset.backgroundSource;
  updateEditorType();
}

function updateAnswerControls() {
  const controlType = questionType.value === "multiple" ? "checkbox" : "radio";
  document.querySelectorAll("#answer-rows .inline-check input").forEach((input) => {
    input.type = controlType;
    input.name = "correct-answer";
  });
}

function updateOpenEditorMode() {
  const isLlm = questionType.value === "llm";
  const useSlots = !isLlm && document.getElementById("multi-slot-toggle").checked;
  document.getElementById("accepted-answer-editor").classList.toggle("hidden", useSlots);
  document.getElementById("slot-editor").classList.toggle("hidden", !useSlots);
}

function addAnswerRow(answer = {text: "", is_correct: false}) {
  const rowEl = document.createElement("div");
  rowEl.className = "answer-row";

  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.value = answer.text || "";
  inputEl.placeholder = "Odpowiedź";

  const correctLabel = document.createElement("label");
  correctLabel.className = "inline-check";
  const correctInput = document.createElement("input");
  correctInput.type = questionType.value === "multiple" ? "checkbox" : "radio";
  correctInput.name = "correct-answer";
  correctInput.checked = Boolean(answer.is_correct);
  correctLabel.append(correctInput, document.createTextNode("poprawna"));

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary-button";
  removeButton.textContent = "Usuń";
  removeButton.addEventListener("click", () => rowEl.remove());

  rowEl.append(inputEl, correctLabel, removeButton);
  document.getElementById("answer-rows").appendChild(rowEl);
}

function addAcceptedAnswerRow(value = "") {
  const rowEl = document.createElement("div");
  rowEl.className = "accepted-answer-row";

  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.value = value;
  inputEl.placeholder = questionType.value === "llm" ? "Odpowiedź wzorcowa" : "Wariant odpowiedzi";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary-button";
  removeButton.textContent = "Usuń";
  removeButton.addEventListener("click", () => rowEl.remove());

  rowEl.append(inputEl, removeButton);
  document.getElementById("accepted-answer-rows").appendChild(rowEl);
}

function addSlotRow(values = [""]) {
  const rowEl = document.createElement("div");
  rowEl.className = "slot-row";

  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.value = values.join("; ");
  inputEl.placeholder = "Warianty po średniku";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary-button";
  removeButton.textContent = "Usuń";
  removeButton.addEventListener("click", () => rowEl.remove());

  rowEl.append(inputEl, removeButton);
  document.getElementById("slot-rows").appendChild(rowEl);
}

function addOrderItemRow(item = {id: "", text: ""}) {
  const rowEl = document.createElement("div");
  rowEl.className = "order-item-row";
  rowEl.dataset.orderItemId = item.id || "";

  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.value = item.text || "";
  inputEl.placeholder = "Element w kolejności";

  const moveUpButton = document.createElement("button");
  moveUpButton.type = "button";
  moveUpButton.className = "secondary-button";
  moveUpButton.textContent = "Wyżej";
  moveUpButton.addEventListener("click", () => moveOrderItemRow(rowEl, -1));

  const moveDownButton = document.createElement("button");
  moveDownButton.type = "button";
  moveDownButton.className = "secondary-button";
  moveDownButton.textContent = "Niżej";
  moveDownButton.addEventListener("click", () => moveOrderItemRow(rowEl, 1));

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary-button";
  removeButton.textContent = "Usuń";
  removeButton.addEventListener("click", () => {
    rowEl.remove();
    updateOrderItemControls();
  });

  rowEl.append(inputEl, moveUpButton, moveDownButton, removeButton);
  document.getElementById("order-item-rows").appendChild(rowEl);
  updateOrderItemControls();
}

function moveOrderItemRow(rowEl, direction) {
  const parentEl = rowEl.parentElement;
  if (direction < 0 && rowEl.previousElementSibling) {
    parentEl.insertBefore(rowEl, rowEl.previousElementSibling);
  }

  if (direction > 0 && rowEl.nextElementSibling) {
    parentEl.insertBefore(rowEl.nextElementSibling, rowEl);
  }

  updateOrderItemControls();
}

function updateOrderItemControls() {
  const rows = Array.from(document.querySelectorAll("#order-item-rows .order-item-row"));
  rows.forEach((row, index) => {
    const buttons = row.querySelectorAll("button");
    buttons[0].disabled = index === 0;
    buttons[1].disabled = index === rows.length - 1;
  });
}

function addMatchingPairRow(pair = {id: "", left: "", right: ""}) {
  const rowEl = document.createElement("div");
  rowEl.className = "matching-pair-row";
  rowEl.dataset.matchingPairId = pair.id || "";

  const leftInputEl = document.createElement("input");
  leftInputEl.type = "text";
  leftInputEl.value = pair.left || "";
  leftInputEl.placeholder = "Lewy element";

  const rightInputEl = document.createElement("input");
  rightInputEl.type = "text";
  rightInputEl.value = pair.right || "";
  rightInputEl.placeholder = "Dopasowanie";

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "secondary-button";
  removeButton.textContent = "Usuń";
  removeButton.addEventListener("click", () => rowEl.remove());

  rowEl.append(leftInputEl, rightInputEl, removeButton);
  document.getElementById("matching-pair-rows").appendChild(rowEl);
}

async function collectQuestionPayload() {
  const explanation = document.getElementById("question-explanation").value.trim();
  const payload = {
    selection_type: questionType.value,
    text: document.getElementById("question-text").value.trim()
  };

  if (explanation) {
    payload.explanation = explanation;
  }

  const contextText = document.getElementById("context-text").value.trim();
  if (contextText) {
    payload.context = {text: contextText};
  }

  if (payload.selection_type === "single" || payload.selection_type === "open") {
    const imageUrl = document.getElementById("image-url").value.trim();
    const imageFile = document.getElementById("image-file").files[0];
    if (imageUrl) {
      payload.image = imageUrl;
    }
    if (imageFile) {
      payload.image_upload = await readImageFile(imageFile);
    }
  }

  if (payload.selection_type === "open" || payload.selection_type === "llm") {
    if (payload.selection_type === "open" && document.getElementById("multi-slot-toggle").checked) {
      payload.answer_slots = Array.from(document.querySelectorAll("#slot-rows .slot-row input"))
        .map((input) => ({
          accepted_answers: input.value.split(";").map((value) => value.trim()).filter(Boolean)
        }))
        .filter((slot) => slot.accepted_answers.length > 0);
    } else {
      payload.accepted_answers = Array.from(document.querySelectorAll("#accepted-answer-rows input"))
        .map((input) => input.value.trim())
        .filter(Boolean);
    }
  } else if (payload.selection_type === "order") {
    payload.order_items = Array.from(document.querySelectorAll("#order-item-rows .order-item-row")).map((row) => {
      const input = row.querySelector("input[type='text']");
      return {id: row.dataset.orderItemId || "", text: input.value.trim()};
    }).filter((item) => item.text);
  } else if (payload.selection_type === "matching") {
    payload.matching_pairs = Array.from(document.querySelectorAll("#matching-pair-rows .matching-pair-row")).map((row) => {
      const inputs = row.querySelectorAll("input[type='text']");
      return {
        id: row.dataset.matchingPairId || "",
        left: inputs[0].value.trim(),
        right: inputs[1].value.trim()
      };
    }).filter((pair) => pair.left || pair.right);
  } else if (payload.selection_type === "map") {
    payload.map_config = {
      source: document.getElementById("map-source").value,
      mode: document.getElementById("map-mode").value,
      target_feature_id: document.getElementById("map-target-feature-id").value.trim()
    };
    const backgroundSource = document.getElementById("map-background-source").value.trim();
    if (backgroundSource) {
      payload.map_config.background_source = backgroundSource;
    }
    if (payload.map_config.mode === "identify") {
      payload.answers = Array.from(document.querySelectorAll("#answer-rows .answer-row")).map((row) => {
        const input = row.querySelector("input[type='text']");
        const correct = row.querySelector("input[type='checkbox'], input[type='radio']");
        return {text: input.value.trim(), is_correct: correct.checked};
      }).filter((answer) => answer.text);
    }
  } else {
    payload.answers = Array.from(document.querySelectorAll("#answer-rows .answer-row")).map((row) => {
      const input = row.querySelector("input[type='text']");
      const correct = row.querySelector("input[type='checkbox'], input[type='radio']");
      return {text: input.value.trim(), is_correct: correct.checked};
    }).filter((answer) => answer.text);
  }

  return payload;
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({filename: file.name, content_base64: reader.result});
    });
    reader.addEventListener("error", () => reject(new Error("Nie udało się odczytać pliku obrazka.")));
    reader.readAsDataURL(file);
  });
}

function handleImageUrlInput(event) {
  if (event.currentTarget.value.trim()) {
    document.getElementById("image-file").value = "";
  }
  updateImagePreview();
}

function handleImageFileChange(event) {
  if (event.currentTarget.files.length > 0) {
    document.getElementById("image-url").value = "";
  }
  updateImagePreview();
}

function handleImageDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("is-dragging");
}

function handleImageDragLeave(event) {
  event.currentTarget.classList.remove("is-dragging");
}

function handleImageDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove("is-dragging");

  const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
  if (!file) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  const imageFileInput = document.getElementById("image-file");
  imageFileInput.files = transfer.files;
  imageFileInput.dispatchEvent(new Event("change", {bubbles: true}));
}

function clearSelectedImage() {
  document.getElementById("image-url").value = "";
  document.getElementById("image-file").value = "";
  updateImagePreview();
}

function updateImagePreview() {
  const imageUrl = document.getElementById("image-url").value.trim();
  const imageFile = document.getElementById("image-file").files[0];
  const previewEl = document.getElementById("image-preview");
  const previewImgEl = document.getElementById("image-preview-img");
  const previewNameEl = document.getElementById("image-preview-name");
  const uploadControlsEl = document.getElementById("image-upload-controls");

  clearImagePreviewObjectUrl();

  if (imageFile) {
    imagePreviewObjectUrl = URL.createObjectURL(imageFile);
    previewImgEl.src = imagePreviewObjectUrl;
    previewNameEl.textContent = imageFile.name;
    previewEl.classList.remove("hidden");
    uploadControlsEl.classList.add("hidden");
    return;
  }

  if (imageUrl) {
    previewImgEl.src = imageUrl;
    previewNameEl.textContent = imageUrl;
    previewEl.classList.remove("hidden");
    uploadControlsEl.classList.add("hidden");
    return;
  }

  previewImgEl.removeAttribute("src");
  previewNameEl.textContent = "";
  previewEl.classList.add("hidden");
  uploadControlsEl.classList.remove("hidden");
}

function clearImagePreviewObjectUrl() {
  if (!imagePreviewObjectUrl) return;
  URL.revokeObjectURL(imagePreviewObjectUrl);
  imagePreviewObjectUrl = "";
}

function validatePayload(payload) {
  if (!payload.text) return "Wpisz treść pytania.";
  if (!["single", "multiple"].includes(payload.selection_type) && !payload.explanation) return "Wpisz wyjaśnienie.";
  if (payload.context && !payload.context.text) return "Tekst źródłowy nie może być pusty.";
  if (payload.image && payload.image_upload) return "Wybierz link albo plik obrazka, nie oba naraz.";
  if ((payload.image || payload.image_upload) && !["single", "open"].includes(payload.selection_type)) {
    return "Pytanie obrazkowe może być tylko typu jedna odpowiedź albo odpowiedź pisemna.";
  }

  if (payload.selection_type === "single") {
    const correctCount = payload.answers.filter((answer) => answer.is_correct).length;
    if (payload.answers.length < 2) return "Dodaj co najmniej dwie odpowiedzi.";
    if (correctCount !== 1) return "Zaznacz dokładnie jedną poprawną odpowiedź.";
  }

  if (payload.selection_type === "multiple") {
    const correctCount = payload.answers.filter((answer) => answer.is_correct).length;
    if (payload.answers.length < 2) return "Dodaj co najmniej dwie odpowiedzi.";
    if (correctCount < 2) return "Zaznacz co najmniej dwie poprawne odpowiedzi.";
  }

  if (payload.selection_type === "open" || payload.selection_type === "llm") {
    if (payload.answer_slots) {
      if (payload.answer_slots.length === 0) return "Dodaj co najmniej jedno pole odpowiedzi.";
    } else if (!payload.accepted_answers || payload.accepted_answers.length === 0) {
      return "Dodaj co najmniej jeden wariant poprawnej odpowiedzi.";
    }
  }

  if (payload.selection_type === "order") {
    if (!payload.order_items || payload.order_items.length < 2) {
      return "Dodaj co najmniej dwa elementy do ułożenia.";
    }
  }

  if (payload.selection_type === "matching") {
    if (!payload.matching_pairs || payload.matching_pairs.length < 2) {
      return "Dodaj co najmniej dwie pary do dopasowania.";
    }
    if (payload.matching_pairs.some((pair) => !pair.left || !pair.right)) {
      return "Każda para musi mieć lewy element i dopasowanie.";
    }
    const leftLabels = payload.matching_pairs.map((pair) => pair.left.toLocaleLowerCase("pl-PL"));
    if (new Set(leftLabels).size !== leftLabels.length) {
      return "Lewe elementy w parach nie mogą się powtarzać.";
    }
  }

  if (payload.selection_type === "map") {
    if (!payload.map_config.source || !payload.map_config.target_feature_id) {
      return "Wybierz mapę i wpisz identyfikator poprawnego regionu.";
    }
    if (!["select", "identify"].includes(payload.map_config.mode)) {
      return "Wybierz tryb odpowiedzi dla mapy.";
    }
    if (payload.map_config.mode === "identify") {
      const correctCount = (payload.answers || []).filter((answer) => answer.is_correct).length;
      if ((payload.answers || []).length < 2) return "Dodaj co najmniej dwie odpowiedzi.";
      if (correctCount !== 1) return "Zaznacz dokładnie jedną poprawną odpowiedź.";
    }
  }

  return "";
}

async function saveQuestion(event) {
  event.preventDefault();
  formError.classList.add("hidden");
  const payload = await collectQuestionPayload();
  const validationError = validatePayload(payload);

  if (validationError) {
    formError.textContent = validationError;
    formError.classList.remove("hidden");
    return;
  }

  try {
    const baseUrl = `/api/admin/chapters/${selectedChapter.id}/topics/${selectedTopic.id}/questions`;
    const url = editingQuestionId ? `${baseUrl}/${editingQuestionId}` : baseUrl;
    const method = editingQuestionId ? "PUT" : "POST";
    await adminFetch(url, {method, body: JSON.stringify(payload)});
    closeEditor();
    await loadQuestions();
    showQuestionView();
    showStatus("Zapisano pytanie.");
  } catch (error) {
    formError.textContent = error.message;
    formError.classList.remove("hidden");
  }
}

async function deleteQuestion(question) {
  if (!confirm("Czy na pewno usunąć to pytanie?")) {
    return;
  }

  await adminFetch(`/api/admin/chapters/${selectedChapter.id}/topics/${selectedTopic.id}/questions/${question.id}`, {
    method: "DELETE"
  });
  await loadQuestions();
  showQuestionView();
  showStatus("Usunięto pytanie.");
}

async function logout() {
  await fetch("/api/admin/logout", {method: "POST"});
  window.location.href = "/admin/login.html";
}

initAdmin().catch((error) => showStatus(error.message, true));
