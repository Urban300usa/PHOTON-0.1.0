import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MapPin } from "lucide-react";
import { securityColor, formatSecurity } from "@/lib/jump-planner/distance";

interface SystemData {
  name: string;
  sec: number;
  regId: number;
}

interface SystemSearchProps {
  systems: Record<string, SystemData>;
  regions: Record<string, string>;
  value: { id: number; name: string } | null;
  onSelect: (systemId: number, systemName: string) => void;
  placeholder?: string;
  label?: string;
  mapSelectedSystem?: number | null; // System selected from map click
}

export default function SystemSearch({
  systems,
  regions,
  value,
  onSelect,
  placeholder = "Search system...",
  label,
  mapSelectedSystem,
}: SystemSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle map-selected system
  useEffect(() => {
    if (mapSelectedSystem && systems[mapSelectedSystem.toString()]) {
      const sys = systems[mapSelectedSystem.toString()];
      onSelect(mapSelectedSystem, sys.name);
      setQuery("");
      setIsOpen(false);
    }
  }, [mapSelectedSystem]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    const matches: { id: number; name: string; sec: number; region: string }[] = [];

    for (const [idStr, sys] of Object.entries(systems)) {
      if (sys.name.toLowerCase().includes(lowerQuery)) {
        matches.push({
          id: parseInt(idStr),
          name: sys.name,
          sec: sys.sec,
          region: regions[sys.regId.toString()] || "Unknown",
        });
      }
      if (matches.length >= 50) break;
    }

    // Sort: exact match first, then starts-with, then includes
    matches.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      if (aLower === lowerQuery) return -1;
      if (bLower === lowerQuery) return 1;
      const aStarts = aLower.startsWith(lowerQuery);
      const bStarts = bLower.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aLower.localeCompare(bLower);
    });

    return matches.slice(0, 20);
  }, [query, systems, regions]);

  return (
    <div className="relative">
      {label && (
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query || (value ? value.name : "")}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
            // Clear display value on focus to allow typing
            if (value && !query) setQuery("");
          }}
          placeholder={placeholder}
          className="pl-8 h-8 text-sm"
        />
        {value && (
          <Badge
            variant="outline"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 h-5"
            style={{ borderColor: securityColor(systems[value.id.toString()]?.sec ?? 0) }}
          >
            <span style={{ color: securityColor(systems[value.id.toString()]?.sec ?? 0) }}>
              {formatSecurity(systems[value.id.toString()]?.sec ?? 0)}
            </span>
          </Badge>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg"
        >
          <ScrollArea className="max-h-[240px]">
            {results.map((sys) => (
              <button
                key={sys.id}
                className="w-full px-3 py-1.5 text-left hover:bg-accent flex items-center gap-2 text-sm"
                onClick={() => {
                  onSelect(sys.id, sys.name);
                  setQuery("");
                  setIsOpen(false);
                }}
              >
                <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: securityColor(sys.sec) }} />
                <span className="font-medium">{sys.name}</span>
                <span
                  className="text-xs font-mono"
                  style={{ color: securityColor(sys.sec) }}
                >
                  {formatSecurity(sys.sec)}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">{sys.region}</span>
              </button>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
