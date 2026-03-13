## Komponententest vs Integrationstest

**Komponententest** - eine einzelne Komponente wird isoliert getestet. Alles was sie von außen braucht (andere Komponenten, Libraries, APIs) wird gemockt. Man prüft nur ob die Komponente selbst korrekt funktioniert.

```tsx
// Nur SingleImageUpload wird getestet
// fetch, Leaflet, etc. existieren hier nicht - werden gemockt
describe("SingleImageUpload", () => {
  it("zeigt Vorschaubild nach Upload", async () => {
    render(<SingleImageUpload />);
    await userEvent.upload(screen.getByTestId("file-input"), file);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});
```

**Integrationstest** - mehrere Komponenten werden zusammen getestet, so wie sie in der echten App zusammenspielen. Nur was wirklich nicht funktioniert in jsdom (echter Server, Cloud-Speicher) wird gemockt.

```tsx
// Die ganze ReportSightingPage wird getestet
// SingleImageUpload, List, LocationPicker - alles zusammen
describe("ReportSightingPage Integration", () => {
  it("schickt Daten ab wenn Formular ausgefüllt wird", async () => {
    render(<ReportSightingPage />);
    await userEvent.type(screen.getByPlaceholderText("Latitude"), "48.2082");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/sightings"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
```

---

## Was ist jsdom

jsdom ist eine **JavaScript-Implementierung des Browser-DOMs** - also eine Simulation des Browsers, die in Node.js läuft.

Vitest (und Jest) laufen in **Node.js**, nicht im Browser. Node.js kennt aber Dinge wie `document`, `window`, `querySelector` etc.  nicht - das sind Browser-APIs.

```tsx
// In Node.js ohne jsdom:
document.getElementById('app') //  ReferenceError: document is not defined
```

jsdom stellt diese Browser-APIs in Node.js zur Verfügung - es _simuliert_ einen Browser:

```tsx
// Mit jsdom im Test:
document.getElementById('app') // funktioniert
window.location.href            // funktioniert
localStorage.setItem(...)       // funktioniert
```

Es implementiert HTML-Parsing, DOM-Manipulation, Events, CSS-Selektoren usw. - alles was `@testing-library/react` braucht um Komponenten zu rendern und zu testen.

---

## vitest

https://vitest.dev/guide/test-tags.html

Vitest ist der eigentliche test-runner, zuständig dafür Tests auszuführen und Ergebnisse zu evaluieren. 

### Was ein Test-Runner konkret macht

1. Testdateien finden (`*.test.ts`, `*.spec.ts`)
2. Tests ausführen
3. Ergebnis ausgeben (richtig / falsch)
4. Coverage berechnen (optional)

---

## RTL - React Testing Library

https://testing-library.com/docs/react-testing-library/example-intro

Eine Test-Hilfsbibliothek die erlaubt, React-Komponenten so zu testen **wie ein echter Nutzer sie benutzen würde** - also über das DOM. Das bedeutet: **nicht** auf Props, State oder Komponenteninstanzen zugreifen - sondern nur auf das, was im DOM sichtbar ist.

```tsx
// SCHLECHT Enzyme-Stil (implementation details)
wrapper.find(Button).prop('onClick')()
wrapper.state('isLoading')

// GUT RTL-Stil (user-facing)
await userEvent.click(screen.getByRole('button'))
expect(screen.getByText('Wird geladen...')).toBeInTheDocument()
```

### Wichtigen Teile

`render()`
Rendert Komponente in jsdon:
```tsx
render(<MyComponent name="..." />)
```

Zugriff aufs gerenderte DOM - die wichtigsten Queries:

| Query                  | Wann benutzen                      |
| ---------------------- | ---------------------------------- |
| `getByRole`            | Beste Wahl - sucht nach ARIA-Rolle |
| `getByText`            | Sichtbarer Text                    |
| `getByLabelText`       | Formularfelder via Label           |
| `getByPlaceholderText` | Placeholder-Attribut               |
| `findBy...`            | Async (gibt Promise zurück)        |
| `queryBy...`           | Wenn Element evtl. nicht existiert |

```tsx
screen.getByRole('button', { name: /absenden/i })
screen.getByLabelText('Email')
await screen.findByText('Erfolgreich!') // wartet bis erscheint
```

 `userEvent`
Simuliert echte Nutzerinteraktionen (besser als `fireEvent`):
```tsx
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.type(screen.getByLabelText('Name'), '...')
await user.click(screen.getByRole('button', { name: /senden/i }))
```

---

## Setup

**Commands und Code-Snippets**

vitest intallieren

```bash
npm install --save-dev vitest
```

RTL installiere:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Vitest config files

*vite.config.ts:*
```ts
import { defineConfig } from 'vitest/config'  // ← vitest/config nicht vite!
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setup.ts',
  },
})
```

*tsconfig.json:*
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

*package.json:*
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

### RTL config files

*src/setup.ts erstellen*
```ts
import '@testing-library/jest-dom'
```

*tsconfig.json:*
```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

---

## Code Snippets

**`vi.fn()` - Mock-Funktionen** Erstellt eine leere Funktion die nichts tut, aber jeden Aufruf aufzeichnet. Damit kannst du prüfen ob eine Funktion aufgerufen wurde und mit welchen Argumenten - das kann eine normale Funktion nicht.

```js
const onImageSelect = vi.fn();
onImageSelect("hallo");
expect(onImageSelect).toHaveBeenCalledWith("hallo");
```

**`vi.mock(...)` - Module/Komponenten mocken** Ersetzt ein ganzes Modul oder eine Komponente durch eine vereinfachte Version. Nötig wenn etwas in jsdom nicht funktioniert (Leaflet, Socket.io, Azure) oder wenn eine Komponente für den aktuellen Test irrelevant ist.

```js
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div>{children}</div>,
  TileLayer: () => null,
}));
```

**Wrapper-Komponenten** Wenn eine Komponente keinen eigenen State verwaltet, braucht man im Test einen Wrapper der den State hält und als Props weitergibt - genau wie ein echtes Elternelement es tun würde.

```js
function Wrapper() {
  const [value, setValue] = useState("");
  return <MeineKomponente value={value} setValue={setValue} />;
}
```

**`render` + `screen.getByX`** Komponente rendern und dann Elemente suchen - per Role, Text, Label oder Placeholder. `getByRole` ist bevorzugt weil es gleichzeitig Accessibility testet.

```js
render(<Wrapper />);
screen.getByRole("button", { name: /submit/i });  // per Rolle
screen.getByLabelText(/datum/i);                  // per Label
screen.getByPlaceholderText("Latitude");          // per Placeholder
screen.getByText(/choose a file/i);               // per Text
```

**`waitFor` / `findByX`** Warten auf asynchrone State-Updates in React. `waitFor` mit einer Bedingung, `findByX` ist die async-Variante von `getByX` - macht dasselbe aber kompakter.

```js
await waitFor(() => expect(onImageSelect).toHaveBeenCalled());
// oder kürzer:
await screen.findByRole("img", { name: /marker/i });
```

**`mockResolvedValue` / `mockResolvedValueOnce`** Wie `vi.fn()` aber gibt einen fixen Wert zurück - nützlich um Server-Antworten zu simulieren. `Once` gilt nur für einen Aufruf, danach fällt es auf den Standard zurück.

```js
// gilt für alle Aufrufe
(fetch as any).mockResolvedValue({ ok: true });

// gilt nur für den nächsten Aufruf
(fetch as any).mockResolvedValueOnce({
  ok: true,
  json: async () => ({ uploadURL: "https://mock-storage.com/upload" })
});
```

**Blob URLs** `URL.createObjectURL` erstellt eine temporäre URL für eine Datei (für Image-Preview). Muss mit `URL.revokeObjectURL` wieder freigegeben werden, sonst Memory Leak.

```js
const url = URL.createObjectURL(file); // "blob:http://localhost/abc123"
<img src={url} />
// beim Entfernen des Bildes:
URL.revokeObjectURL(url); // Speicher freigeben
```