const SUBJECT_PAGE_CONFIG = {
  history: {
    emptyText: "Brak dostępnych quizów z historii.",
    categories: ["history", "llm"],
    countLabel: "dostępnych quizów"
  },
  geography: {
    emptyText: "Brak dostępnych quizów z geografii.",
    categories: ["geography"],
    countLabel: "dostępnych quizów"
  },
  biology: {
    emptyText: "Brak dostępnych quizów z biologii.",
    categories: ["biology"],
    countLabel: "dostępnych quizów"
  }
};

const SUBJECT_ICON_SVGS = {
  flag: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4" />
      <path d="M5 5h11l-1.8 3L16 11H5" />
    </svg>
  `,
  castle: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 21V9h4V5h3v4h2V5h3v4h4v12" />
      <path d="M3 21h18" />
      <path d="M9 21v-5a3 3 0 0 1 6 0v5" />
    </svg>
  `,
  scroll: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5a3 3 0 0 1 3-3h8v16a3 3 0 0 1-3 3H7" />
      <path d="M7 5a3 3 0 0 0 0 6h2V5" />
      <path d="M11 8h4" />
      <path d="M11 12h4" />
    </svg>
  `,
  book: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
    </svg>
  `
};

function getSubjectPageConfig() {
  const subject = document.body.dataset.subject || "history";
  return {
    subject,
    ...(SUBJECT_PAGE_CONFIG[subject] || SUBJECT_PAGE_CONFIG.history)
  };
}

function createQuizCard(quiz, subject) {
  const cardEl = document.createElement("article");
  cardEl.className = "quiz-card";

  const iconEl = document.createElement("span");
  iconEl.className = "quiz-card-icon";
  iconEl.innerHTML = SUBJECT_ICON_SVGS[getQuizIconName(quiz)] || SUBJECT_ICON_SVGS.book;

  const contentEl = document.createElement("div");
  contentEl.className = "quiz-card-content";

  const chapterLabel = getChapterLabel(quiz);
  if (chapterLabel) {
    const chapterEl = document.createElement("span");
    chapterEl.className = "chapter-label";
    chapterEl.textContent = chapterLabel;
    contentEl.appendChild(chapterEl);
  }

  const titleEl = document.createElement("h2");
  titleEl.textContent = quiz.title;

  const descriptionEl = document.createElement("p");
  descriptionEl.textContent = quiz.description;

  const startButton = document.createElement("button");
  startButton.className = "quiz-start-button";
  startButton.type = "button";
  startButton.textContent = "Rozpocznij quiz \u2192";
  startButton.addEventListener("click", () => {
    window.location.href = `quiz.html?id=${encodeURIComponent(quiz.id)}&section=${encodeURIComponent(subject)}`;
  });

  contentEl.append(titleEl, descriptionEl);
  cardEl.append(iconEl, contentEl, startButton);
  return cardEl;
}

function getQuizIconName(quiz) {
  const text = `${quiz.id || ""} ${quiz.title || ""}`.toLocaleLowerCase("pl-PL");
  if (text.includes("napoleon") || text.includes("rewolucja")) return "scroll";
  if (text.includes("rzeczypospolitej") || text.includes("konfederacja")) return "castle";
  if (text.includes("polska") || text.includes("niepodleg")) return "flag";
  if (text.includes("cywilizacje")) return "scroll";
  return "book";
}

function getChapterLabel(quiz) {
  const source = `${quiz.id || ""} ${quiz.title || ""} ${quiz.description || ""}`;
  const match = source.match(/(?:chapter|rozdzia[lł])[-\s:]*(\d+)/i);
  return match ? `Rozdział ${match[1]}` : "";
}

function updateQuizCount(count, config) {
  const countEl = document.getElementById("quiz-count");
  if (!countEl) return;

  countEl.textContent = `${count} ${config.countLabel}`;
  countEl.classList.toggle("hidden", count === 0);
}

async function renderSubjectQuizList() {
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("quiz-list");
  const config = getSubjectPageConfig();
  const categories = new Set(config.categories);

  try {
    const quizzes = await getQuizzes();
    const subjectQuizzes = quizzes.filter((quiz) => categories.has(quiz.category));

    statusEl.textContent = "";
    listEl.replaceChildren();
    updateQuizCount(subjectQuizzes.length, config);

    if (!subjectQuizzes.length) {
      statusEl.textContent = config.emptyText;
      return;
    }

    subjectQuizzes.forEach((quiz) => {
      listEl.appendChild(createQuizCard(quiz, config.subject));
    });
  } catch (error) {
    statusEl.textContent = `Błąd: ${error.message}`;
  }
}
