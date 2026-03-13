// LocationPicker.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useState } from "react";
import LocationPicker from "./locationPicker";

// leaflet & react-leaflet mocken da in jsdom nicht funktioniert
// vi.mock ersetzt komplettes modulmit eigener implementierung,
// sprich leaflet komponenten wird mit einfachem htlm ersetzt
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => (
    <div role="region" aria-label="Karte">
      {children}
    </div>
  ),
  TileLayer: () => null, // hier die ap tiles auf null da sie eigentlich nicht gebraucht
  Marker: () => <div role="img" aria-label="Standort Marker" />,

  // useMapEvents ist eigenlich leaflet hook für karten clicks auf echter karte
  // da das in jsdom nicht funktioniert hängt mock eine funktion an
  // window.__simulateMapClick, damit kann test manuell einen kartenclick auslösen
  useMapEvents: (events: any) => {
    (window as any).__simulateMapClick = (lat: number, lng: number) => {
      events.click({ latlng: { lat, lng } });
    };
    return null;
  },
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet", () => ({}));

// LocationPicker selber speichert keine koordinaten, bekommt setLatitude und setLongitude
// als props, state selber ist in elternelement, da kein echtes elternelement in test wird
// im wrapper echter state verwaltet und aktuelle werte im dom angezeigt die test prüfen kann
function LocationPickerWrapper() {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  return (
    <>
      <LocationPicker
        latitude={latitude}
        longitude={longitude}
        setLatitude={setLatitude}
        setLongitude={setLongitude}
      />
      {/* Zeigt die Werte an damit wir sie testen können */}
      <p data-testid="lat-display">{latitude}</p>
      <p data-testid="lng-display">{longitude}</p>
    </>
  );
}

describe("LocationPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // wieder gleiche tests ob elemente richtig gerendert, genauere erklärung in locationPicker.test.tsx
  describe("Darstellung", () => {
    it("rendert die Karte", () => {
      render(<LocationPickerWrapper />);
      expect(
        screen.getByRole("region", { name: /karte/i }),
      ).toBeInTheDocument();
    });

    it("rendert den Hinweistext", () => {
      render(<LocationPickerWrapper />);
      expect(screen.getByText(/where did you see emil/i)).toBeInTheDocument();
    });

    it("zeigt keinen Marker wenn keine Koordinaten vorhanden", () => {
      render(<LocationPickerWrapper />);
      expect(
        screen.queryByRole("img", { name: /standort marker/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Interaktion", () => {
    it("setzt Latitude und Longitude nach Klick auf die Karte", async () => {
      render(<LocationPickerWrapper />);

      // jetzt kommen tests mit kartenpositionen, hier wird __simulateMapClick verwendet
      // um input auf map location zu simulieren
      await userEvent.click(screen.getByRole("region", { name: /karte/i }));
      (window as any).__simulateMapClick(48.2082, 16.3738);

      // dann überprüft ob eingaben auf der map richtig
      await waitFor(() => {
        expect(screen.getByTestId("lat-display")).toHaveTextContent("48.2082");
        expect(screen.getByTestId("lng-display")).toHaveTextContent("16.3738");
      });
    });

    it("zeigt Marker nachdem Koordinaten gesetzt wurden", async () => {
      render(<LocationPickerWrapper />);

      (window as any).__simulateMapClick(48.2082, 16.3738);

      // hier nach simuliertem click soll der punkt auf der karte erscheinen
      // mock marker ist ein <div role="img"> -> test kann es finden
      expect(
        await screen.findByRole("img", { name: /standort marker/i }), // findByRole ist async variante von getByRole, kein waitFor benötigt
      ).toBeInTheDocument();
    });
  });
});

