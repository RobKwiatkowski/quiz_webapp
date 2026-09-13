import { SubjectQuizList } from "./features/subjects/SubjectQuizList";
import { getSubjectFromPath, subjectConfigs, type SubjectId } from "./features/subjects/subject-config";
import { QuizPage } from "./pages/QuizPage";

const homeCards: Record<SubjectId, { label: string; accent: string }> = {
  history: { label: "Opowieści, daty i decyzje", accent: "home-card-history" },
  geography: { label: "Mapy, miejsca i świat", accent: "home-card-geography" },
  biology: { label: "Przyroda, ciało i życie", accent: "home-card-biology" },
};

export function App() {
  if (window.location.pathname.toLowerCase().endsWith("quiz.html")) {
    return <QuizPage />;
  }

  const subjectId = getSubjectFromPath(window.location.pathname);

  if (subjectId) {
    const subject = subjectConfigs[subjectId];

    return (
      <main className="subject-shell">
        <nav aria-label="Nawigacja">
          <a className="back-link" href="index.html">← Menu główne</a>
        </nav>
        <header className="subject-hero">
          <p className="subject-kicker">EDU QUIZ</p>
          <h1>{subject.title}</h1>
          <p>{subject.description}</p>
        </header>
        <section aria-labelledby="quiz-list-title">
          <h2 id="quiz-list-title">Wybierz temat</h2>
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
