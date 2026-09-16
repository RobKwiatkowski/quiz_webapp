import { useEffect, useState } from "react";
import { SubjectQuizList } from "./features/subjects/SubjectQuizList";
import { getSubjectFromPath, subjectConfigs, type SubjectId } from "./features/subjects/subject-config";
import { AdminPage } from "./pages/AdminPage";
import { QuizPage } from "./pages/QuizPage";

const homeCards: Record<SubjectId, { label: string; accent: string }> = {
  history: { label: "Opowieści, daty i decyzje", accent: "home-card-history" },
  geography: { label: "Mapy, miejsca i świat", accent: "home-card-geography" },
  biology: { label: "Przyroda, ciało i życie", accent: "home-card-biology" },
  math: { label: "Liczby, działania i logika", accent: "home-card-math" },
};

export function App() {
  const subjectId = getSubjectFromPath(window.location.pathname);
  const isQuizPage = window.location.pathname.toLowerCase().endsWith("quiz.html");
  const isAdminPage = window.location.pathname.toLowerCase().startsWith("/admin");
  const [startImage] = useState(() => Math.random() < 0.5 ? "start_image_1.png" : "start_image_2.png");

  useEffect(() => {
    if (isQuizPage) {
      document.body.dataset.page = "quiz";
      delete document.body.dataset.subject;
      return;
    }

    delete document.body.dataset.page;
    if (subjectId) document.body.dataset.subject = subjectId;
    else delete document.body.dataset.subject;
  }, [isQuizPage, subjectId]);

  if (isAdminPage) {
    return <AdminPage />;
  }

  if (isQuizPage) {
    return <QuizPage />;
  }

  if (subjectId) {
    const subject = subjectConfigs[subjectId];

    return (
      <main className="container">
        <nav className="quiz-top-nav" aria-label="Nawigacja">
          <a className="quiz-menu-tile" href="index.html">
            <span className="quiz-menu-icon" aria-hidden="true">←</span>
            <span>Menu główne</span>
          </a>
        </nav>
        <section className="start-hero" aria-labelledby="subject-title">
          <img className="start-hero-image" src={`/assets/start-images/${startImage}`} alt="" />
          <div className="start-hero-overlay">
            <h1 id="subject-title">{subject.title}</h1>
            <p>{subject.description}</p>
          </div>
        </section>
        <section aria-label="Lista quizów">
          <SubjectQuizList subject={subject} />
        </section>
      </main>
    );
  }

  return <HomeScreen />;
}

function HomeScreen() {
  return (
    <main className="home-shell">
      <a className="home-admin-link" href="/admin/">
        Panel admina
      </a>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="subject-kicker">EDU QUIZ</p>
          <h1 id="home-title">Wybierz dział nauki</h1>
          <p>Krótka powtórka w formie quizu: zwykłe pytania, mapy, dopasowania i zadania interaktywne w jednym miejscu.</p>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <img src="/assets/start-images/start_image_1.png" alt="" />
        </div>
      </section>

      <section className="home-subject-grid" aria-label="Działy nauki">
        {Object.values(subjectConfigs).map((subject) => {
          const card = homeCards[subject.id];

          return (
            <a key={subject.id} className={`home-subject-card ${card.accent}`} href={`${subject.id}.html`}>
              <span className="home-subject-label">{card.label}</span>
              <span className="home-subject-title">{subject.title}</span>
              <span className="home-subject-description">{subject.description}</span>
              <span className="home-subject-action">
                Start
                <span aria-hidden="true">→</span>
              </span>
            </a>
          );
        })}
      </section>
    </main>
  );
}
