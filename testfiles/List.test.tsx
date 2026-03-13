// List.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import List from "./List";
import { useState } from "react";

// hier wieder locationPicker mocken, dieses mal aber direkt die komplette datei
// komponente wird durch 2 einfache html inputs ersetzt
vi.mock("./locationPicker", () => ({
  default: ({ setLatitude, setLongitude }: any) => (
    <div>
      <input
        placeholder="Latitude"
        onChange={(e) => setLatitude(e.target.value)}
      />
      <input
        placeholder="Longitude"
        onChange={(e) => setLongitude(e.target.value)}
      />
    </div>
  ),
}));

// ähnlich wie bei LocationPickerWrapper, list verwaltet keine eigenen state
// also mit wrapper um state zu speichern und props weitergeben
function ListWrapper() {
  const [reportedAt, setReportedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [activity, setActivity] = useState("");
  const [condition, setCondition] = useState("");

  return (
    <List
      reportedAt={reportedAt}
      setReportedAt={setReportedAt}
      notes={notes}
      setNotes={setNotes}
      latitude={latitude}
      setLatitude={setLatitude}
      longitude={longitude}
      setLongitude={setLongitude}
      activity={activity}
      setActivity={setActivity}
      condition={condition}
      setCondition={setCondition}
    />
  );
}
describe("List", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // mocks vor jedem test zurücksetzen
  });

  // wieder tests ob sachen gerendert werden -> imgUpload.test.txt für details
  describe("Darstellung", () => {
    it("rendert das Datum-Textfeld", () => {
      render(<ListWrapper/>);
      expect(
        screen.getByText(/when did you see him/i)
      ).toBeInTheDocument();
    });

    it("rendert das Notizen-Textfeld", () => {
      render(<ListWrapper/>);
      expect(
        screen.getByText(/what other information/i)
      ).toBeInTheDocument();
    });

    it("rendert die Activity-Dropdown Optionen", () => {
      render(<ListWrapper/>);
      expect(
        screen.getByText(/choose an activity/i)
      ).toBeInTheDocument();
    });

    it("rendert die Condition-Dropdown Optionen", () => {
      render(<ListWrapper/>);
      expect(
        screen.getByText(/choose a condition/i)
      ).toBeInTheDocument();
    });

    it("Fehlermeldung ist zu Beginn versteckt", () => {
      render(<ListWrapper/>);
      // unterschied zu anderen tests, hier direkt mit document.getElementById nicht mir screen.getByX
      // nötig wenn element keine gute rolle oder text hat zum targeten, direkt auf ID zugreifen
      const error = document.getElementById("Date-Format-Wrong"); 
      expect(error).toHaveClass("hidden"); // überprüfung ob fehlermeldung nicht gezeigt wird
    });

    it("Erfolgsmeldung ist zu Beginn versteckt", () => {
      render(<ListWrapper/>);
      const success = document.getElementById("sighting-submitted-successfully");
      expect(success).toHaveClass("hidden");
    });
  });

  // überprüfungen auf interaktionen
  describe("Interaktion", () => {
    it("ruft setReportedAt auf wenn Datum eingegeben wird", async () => {
      render(<ListWrapper />);
      // sucht input feld das mit label versehen ist, in diesem fall der text "wenn did you see him"
      const datumFeld = screen.getByLabelText(/When did you see him\? \(DD\.MM\.YYYY HH\.MM\)/i); // suche passiert mit regex expression, daher "\" benötigt für sonderzeichen
      await userEvent.type(datumFeld, "01.01.2025 10.00"); // input in datumfeld
      expect(datumFeld).toHaveValue("01.01.2025 10.00"); // dann überprüfen obs drinnen steht
    });
    
    // same same
    it("ruft setNotes auf wenn Notizen eingegeben werden", async () => {
      render(<ListWrapper />);
      const notesFeld = screen.getByLabelText(/What other information do you have about Emil?/i);
      await userEvent.type(notesFeld, "Emil humpelte");
      expect(notesFeld).toHaveValue("Emil humpelte");
    });


    it("ruft setLatitude auf wenn Latitude eingegeben wird", async () => {
      render(<ListWrapper/>);
      // hier lässt sich input feld ähnlich finden wie bei oberen,
      // unterschied ist, hier hat input kein label aber
      // einen placeholder text nach dem gesucht werden kann
      await userEvent.type(screen.getByPlaceholderText("Latitude"), "48.2"); 
      expect(screen.getByPlaceholderText("Latitude")).toHaveValue("48.2");    });

      // same same
    it("ruft setLongitude auf wenn Longitude eingegeben wird", async () => {
      render(<ListWrapper/>);
      await userEvent.type(screen.getByPlaceholderText("Longitude"), "16.3");
      expect(screen.getByPlaceholderText("Longitude")).toHaveValue("16.3");
    });
  });
}); 