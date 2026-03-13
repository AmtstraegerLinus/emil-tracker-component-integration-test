// SingleImageUpload.test.tsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import SingleImageUpload from "./imgUpload";

// URL.createObjectURL nicht in jsdom verfügbar -> mocken
(globalThis as any).URL.createObjectURL = vi.fn(() => "mock-preview-url");
(globalThis as any).URL.revokeObjectURL = vi.fn();

// hilfsfunktion um test-datei zu erstellen
const createImageFile = (
  name = "test.jpg",
  type = "image/jpeg",
  size = 1024,
) => {
  const file = new File(["dummy content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("SingleImageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // alle mocks von anderen und vorherigen tests löschen

    // nach Clear müssen rückgabewerte neu gesetzt werden
    (globalThis as any).URL.createObjectURL = vi.fn(() => "mock-preview-url");
    (globalThis as any).URL.revokeObjectURL = vi.fn();
  });

  // --== darstellung ==--
  describe("Darstellung", () => {
    it("rendert die Upload-Area", () => {
      render(<SingleImageUpload />); // jeweils mit render element anzeigen
      expect(
        screen.getByText(/choose a file or drag & drop/i), // regex expression, siehe erklärung -> List.test.tsx
      ).toBeInTheDocument(); // dann nach text suchen und mit toBeInTheDocument checken ob vorhanden
    });

    // same same für die restlichen render tests
    it("rendert den Browse-Button", () => {
      render(<SingleImageUpload />);
      expect(
        screen.getByRole("button", { name: /browse file/i }),
      ).toBeInTheDocument();
    });

    it("zeigt kein Vorschaubild am Anfang", () => {
      render(<SingleImageUpload />);
      expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
    });

    it("zeigt keine Fehlermeldung am Anfang", () => {
      render(<SingleImageUpload />);
      expect(screen.queryByText(/upload error/i)).not.toBeInTheDocument();
    });
  });

  // datei wahl testen
  describe("Datei auswählen", () => {
    it("ruft onImageSelect auf wenn gültige Bilddatei ausgewählt wird", async () => {
      // async weil element erst laden muss
      // genauere erklaerung zu vi.fn
      // zbsp. haben wir eine fuktion, in diesem fall onImageSelect
      // im normalfall macht diese funktion etwas aber hier im test ist uns das was sie genau macht egal,
      // das was uns interesiert ist, wurde die funktion aufgerufen, wurde sie mir richtigen argumenten
      // aufgerufen. das sind sachen die normalerweise von funktion nicht getrackt werden, mit vi.fn schon
      const onImageSelect = vi.fn();
      render(<SingleImageUpload onImageSelect={onImageSelect} />);
      const file = createImageFile(); // test file erstellen mit hilfs funktion

      // userEvent.upload mit dummy file testen
      const input = screen.getByTestId("file-input"); // input element finden
      await userEvent.upload(input, file); // file upload simulieren

      await waitFor(() => {
        expect(onImageSelect).toHaveBeenCalledWith(file); // checken ob file hochgeladen
      });
    });

    it("zeigt Fehler wenn Datei kein Bild ist", async () => {
      render(<SingleImageUpload />);
      const file = new File(["content"], "document.pdf", {
        type: "application/pdf",
      }); // test file erstellen die kein bild is

      const input = screen.getByTestId("file-input"); // file input feld finden

      // ignore: true sagt userEvent dass es das accept-Attribut ignorieren soll
      await userEvent.upload(input, file, { applyAccept: false });

      await waitFor(() => {
        expect(screen.getByText(/file must be an image/i)).toBeInTheDocument(); // bei falschem filetype fehlermeldung erwartet
      });
    });

    // same same, zu große datei erstellen und bei upload fehlermeldung erwarten
    it("zeigt Fehler wenn Datei zu groß ist", async () => {
      render(<SingleImageUpload maxSize={1024} />);
      const file = createImageFile("big.jpg", "image/jpeg", 2048);

      const input = screen.getByTestId("file-input");
      await userEvent.upload(input, file);

      await waitFor(() => {
        expect(
          screen.getByText(/file size must be less than/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Bild entfernen", () => {
    it("ruft onImageSelect mit null auf wenn Bild entfernt wird", async () => {
      const onImageSelect = vi.fn(); // hier wieder die funktion mit vi.fn mocken
      render(<SingleImageUpload onImageSelect={onImageSelect} />);
      const file = createImageFile();

      await userEvent.upload(screen.getByTestId("file-input"), file); // file uploaden
      // waitFor wartet aktiv darauf dass die bedingung wahr wird, gebraucht weil react state-update asnychron sind
      // erwartung ist das onImageSelect aufgerufen wurde und die korrekte file weiter gegeben hat
      await waitFor(() => expect(onImageSelect).toHaveBeenCalledWith(file));

      await userEvent.click(screen.getByRole("button")); // klick auf delete button simulieren

      await waitFor(() => {
        expect(onImageSelect).toHaveBeenCalledWith(null); // erwartet wird das die gemockte methode mit null gecalled wurde da bild removed sein soll
      });
    });

    it("ruft URL.revokeObjectURL auf wenn Bild entfernt wird", async () => {
      // wieder bild hochladen, dieses mal ohne mock prop da onImageSelect nicht benötigt
      render(<SingleImageUpload />);

      // wieder fake file erstellen und input feld finden
      await userEvent.upload(
        screen.getByTestId("file-input"),
        createImageFile(),
      );

      // URL.createObjectURL ist browser api. für bild preview
      // anzeigen macht die komponente intern sowas:
      // const previewUrl = URL.createObjectURL(file); z.B. "blob:http://localhost/abc123"
      // im test wird URL.createObjectURL gemockt, gibt mock-preview-url zurück
      // url wird als src von image tag gesetzt, test prüft ob aufgerufen wurde
      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());

      await userEvent.click(
        // entfernen button click simmulieren
        screen.getByRole("button", { name: /Bild entfernen/i }),
      );

      // da blob-URLs manuell freigegeben werden müssen um memory leaks zu vermeiden,
      // prüfen ob revokeObjectURL aufgerufen wurde
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("mock-preview-url");
    });
  });
});
