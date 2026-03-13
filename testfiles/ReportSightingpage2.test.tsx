// ReportSightingPage.test.tsx
// jetzt ein integration test, unterschied ist das getestet wird wie
// mehrere komponente zusammen spielen
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ReportSightingPage from "./ReportSightingPage";

// --- Mocks ---

// im test kein socket.io -> mocken
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// LocationPicker mocken -> siehe List.test.tsx
vi.mock("../components/ReportSighting/locationPicker", () => ({
  default: ({ setLatitude, setLongitude }: any) => (
    <div>
      <input placeholder="Latitude" onChange={(e) => setLatitude(e.target.value)} />
      <input placeholder="Longitude" onChange={(e) => setLongitude(e.target.value)} />
    </div>
  ),
}));

// gleiche idee wie socket.io
vi.mock("@azure/storage-blob", () => ({
  BlobServiceClient: vi.fn(),
  ContainerClient: vi.fn(),
}));

// fetch mocken
(globalThis as any).fetch = vi.fn(); // im test keinen server anfragen, also fetch komplett durch mock funktion ersetzen
(globalThis as any).URL.createObjectURL = vi.fn(() => "mock-preview-url");
(globalThis as any).URL.revokeObjectURL = vi.fn();

describe("ReportSightingPage Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // mocks von anderen tests clearen

    // fetch gibt standardmäßig Erfolg zurück
    (fetch as any).mockResolvedValue({ // mockResolvedValue ist wie vi.fn() gibt aber fixen wert zurück, hier simuliert er erfolg
      ok: true,
      json: async () => ({ uploadURL: null }),
    });
  });

  // --- Submit Button ---
  // wieder einfacher und repetitive testung von button un visibility
  describe("Submit Button", () => {
    it("ist zu Beginn deaktiviert wenn keine Koordinaten vorhanden", () => {
      render(<ReportSightingPage />);
      expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled(); 
    });

    it("wird aktiv wenn Latitude und Longitude gesetzt werden", async () => {
      render(<ReportSightingPage />);

      await userEvent.type(screen.getByPlaceholderText("Latitude"), "48.2082");
      await userEvent.type(screen.getByPlaceholderText("Longitude"), "16.3738");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
      });
    });

    it("ist deaktiviert wenn Datum falsches Format hat", async () => {
      render(<ReportSightingPage />);

      // Koordinaten setzen damit Button grundsätzlich aktiv wäre
      await userEvent.type(screen.getByPlaceholderText("Latitude"), "48.2082");
      await userEvent.type(screen.getByPlaceholderText("Longitude"), "16.3738");

      // Falsches Datum eingeben
      await userEvent.type(screen.getByLabelText(/when did you see him/i), "falsches-datum");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
      });
    });
  });

  // --- Datum Validierung ---
  describe("Datum Validierung", () => {
    it("zeigt Fehlermeldung bei falschem Datumsformat", async () => {
      render(<ReportSightingPage />);

      await userEvent.type(screen.getByLabelText(/when did you see him/i), "abc");

      await waitFor(() => {
        expect(document.getElementById("Date-Format-Wrong")).not.toHaveClass("hidden");
      });
    });

    it("versteckt Fehlermeldung bei korrektem Datumsformat", async () => {
      render(<ReportSightingPage />);

      const datumFeld = screen.getByLabelText(/when did you see him/i);
      await userEvent.type(datumFeld, "abc");

      await waitFor(() => {
        expect(document.getElementById("Date-Format-Wrong")).not.toHaveClass("hidden");
      });

      // feld leeren und korrektes datum eingeben
      await userEvent.clear(datumFeld);
      await userEvent.type(datumFeld, "01.01.2025 10:00");

      await waitFor(() => {
        expect(document.getElementById("Date-Format-Wrong")).toHaveClass("hidden");
      });
    });
  });

  // --- Formular absenden ---
  describe("Formular absenden", () => {
    it("ruft fetch auf wenn Formular abgesendet wird", async () => {
      render(<ReportSightingPage />);

      // koordinaten setzen
      await userEvent.type(screen.getByPlaceholderText("Latitude"), "48.2082");
      await userEvent.type(screen.getByPlaceholderText("Longitude"), "16.3738");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      // test um sicher zu stellen ob nach submit eine post request
      // geschickt wird. mit .stringContaining geprüft da tatsächlicher
      // url sich ändern kann, objectContaining überprüft ob POST 
      // im objekt ist, objekt darf aber auch andere sachen enthalten
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/sightings"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    // same same rendern überprüfen
    it("zeigt Erfolgsmeldung nach dem Absenden", async () => {
      render(<ReportSightingPage />);

      await userEvent.type(screen.getByPlaceholderText("Latitude"), "48.2082");
      await userEvent.type(screen.getByPlaceholderText("Longitude"), "16.3738");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(document.getElementById("sighting-submitted-successfully"))
          .not.toHaveClass("hidden");
      });
    });

    it("setzt Felder nach dem Absenden zurück", async () => {
      render(<ReportSightingPage />);

      const datumFeld = screen.getByLabelText(/when did you see him/i);
      await userEvent.type(datumFeld, "01.01.2025 10:00");
      await userEvent.type(screen.getByPlaceholderText("Latitude"), "48.2082");
      await userEvent.type(screen.getByPlaceholderText("Longitude"), "16.3738");

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        expect(datumFeld).toHaveValue("");
      });
    });

    it("lädt Bild hoch wenn eine Datei ausgewählt wurde", async () => {
      render(<ReportSightingPage />);

      // simuliert backend antwort "ich habe sichtung gespeichert, hier is die upload url"
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadURL: "https://mock-storage.com/upload" }),
      });

      // bild per drag amd drop hochladen
      const file = new File(["image"], "emil.jpg", { type: "image/jpeg" });
      const dropZone = screen.getByText(/choose a file/i)
        .closest('[class*="border-dashed"]') as HTMLElement; // nächstes elternelement mit css klasse border-dashed suchen

      // hier wird fireEvent benutzt, nicht userEvent
      // unterschied: userEvent simuliert nutzerverhalten wie maus, klicken, tippen
      // fireEvent greif direkt auf DOM events zu, hier nötig weil drag and drop mit userEvent teils fehlerhaft
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

      // koordinaten setzen und absenden
      await userEvent.type(screen.getByPlaceholderText("Latitude"), "48.2082");
      await userEvent.type(screen.getByPlaceholderText("Longitude"), "16.3738");

      await userEvent.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => {
        // erster fetch: POST sighting, zweiter fetch: PUT Bild
        expect(fetch).toHaveBeenCalledTimes(2); // stellt sicher dass beide Requests gemacht wurden, nicht nur einer
        expect(fetch).toHaveBeenLastCalledWith( // prüft zweiten request: geht er an die richtige URL und ist es ein PUT?
          "https://mock-storage.com/upload",
          expect.objectContaining({ method: "PUT" })
        );
      });
    });
  });
});