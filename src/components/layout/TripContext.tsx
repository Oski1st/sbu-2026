import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { demoTrips } from "../../data/demoTrips";
import type { Trip } from "../../types";
const SelectionContext = createContext<{
  selectedTrip?: Trip;
  selectTrip: (trip: Trip) => void;
}>({ selectTrip: () => {} });
const KEY = "oneline:selected-trip";
export function TripProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  function selectTrip(trip: Trip) {
    setId(trip.id);
    try {
      localStorage.setItem(KEY, trip.id);
    } catch {
      /* URL remains the source of truth when storage is unavailable. */
    }
  }
  return (
    <SelectionContext.Provider
      value={{
        selectedTrip: demoTrips.find((trip) => trip.id === id),
        selectTrip,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}
/** Teammates can use this hook, or resolve ?trip= against demoTrips directly. */
export function useSelectedTrip() {
  const context = useContext(SelectionContext);
  const [params] = useSearchParams();
  const { tripId } = useParams();
  const requested = params.get("trip") ?? tripId ?? null;
  return {
    ...context,
    selectedTrip:
      requested === null
        ? context.selectedTrip
        : demoTrips.find((trip) => trip.id === requested),
  };
}
