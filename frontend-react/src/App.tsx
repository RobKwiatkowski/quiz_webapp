import { getRuntimeConfig } from "./runtime-config";

export function App() {
  const config = getRuntimeConfig();

  return (
    <main className="migration-shell">
      <p className="migration-eyebrow">Edu Quiz</p>
      <h1>Fundament migracji React</h1>
      <p>
        Ten ekran nie zastępuje jeszcze działającego frontendu. Jest izolowanym
        punktem startowym dla migracji wykonywanej etapami.
      </p>
      <p className="migration-status">
        Konfiguracja API została odczytana: {config.API_BASE_URL || "adres względny"}.
      </p>
    </main>
  );
}
