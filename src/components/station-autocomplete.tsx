"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  findStationByCrs,
  searchStations,
  type Station,
} from "@/lib/stations/search";

type Props = {
  label: string;
  crs: string;
  onChange: (crs: string, station: Station | null) => void;
  required?: boolean;
  placeholder?: string;
};

export function StationAutocomplete({
  label,
  crs,
  onChange,
  required,
  placeholder = "Type a station name…",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = crs ? findStationByCrs(crs) : undefined;
  const [query, setQuery] = useState(
    selected ? `${selected.stationName} (${selected.crsCode})` : crs,
  );
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [suggestions, setSuggestions] = useState<Station[]>([]);

  useEffect(() => {
    const next = crs ? findStationByCrs(crs) : undefined;
    if (next) {
      setQuery(`${next.stationName} (${next.crsCode})`);
    } else if (!crs) {
      setQuery("");
    }
  }, [crs]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function updateSuggestions(value: string) {
    const results = searchStations(value, 8);
    setSuggestions(results);
    setHighlight(0);
    setOpen(results.length > 0);
  }

  function choose(station: Station) {
    setQuery(`${station.stationName} (${station.crsCode})`);
    onChange(station.crsCode, station);
    setOpen(false);
    setSuggestions([]);
  }

  function onInputChange(value: string) {
    setQuery(value);
    // Only commit a station when the user picks a suggestion — never
    // auto-fill from a 3-letter CRS match (that hijacks typing).
    if (crs) {
      onChange("", null);
    }
    updateSuggestions(value);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(suggestions[highlight]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative block text-sm">
      <label
        className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-ink-muted"
        htmlFor={listId}
      >
        {label}
      </label>
      <input
        id={listId}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        className="board-input"
        value={query}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onInputChange(e.target.value)}
        onFocus={() => {
          if (query.trim().length >= 2) updateSuggestions(query);
        }}
        onKeyDown={onKeyDown}
      />
      {crs && (
        <p className="mono mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-muted">
          CRS {crs}
        </p>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto border border-line bg-paper py-1 shadow-[var(--shadow)]"
        >
          {suggestions.map((station, i) => (
            <li
              key={station.crsCode}
              role="option"
              aria-selected={i === highlight}
            >
              <button
                type="button"
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left ${
                  i === highlight
                    ? "bg-rail/15 text-ink"
                    : "hover:bg-paper-2"
                }`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(station)}
              >
                <span>{station.stationName}</span>
                <span className="mono shrink-0 text-xs text-ink-muted">
                  {station.crsCode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
