import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Radio, Plus, Trash2, MapPin, Signal } from "lucide-react";
import SystemSearch from "./SystemSearch";

interface Beacon {
  id: string;
  systemId: number;
  systemName: string;
  networkName: string;
  beaconType: string;
  notes: string | null;
}

interface SystemData {
  name: string;
  sec: number;
  regId: number;
  x: number;
  y: number;
  z: number;
  conId: number;
}

interface BeaconManagerProps {
  systems: Record<string, SystemData>;
  regions: Record<string, string>;
  selectedNetwork: string;
  onNetworkChange: (network: string) => void;
  beaconSystemIds: Set<number>;
}

export default function BeaconManager({
  systems,
  regions,
  selectedNetwork,
  onNetworkChange,
  beaconSystemIds,
}: BeaconManagerProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [newSystem, setNewSystem] = useState<{ id: number; name: string } | null>(null);
  const [newType, setNewType] = useState("cyno_alt");
  const [newNotes, setNewNotes] = useState("");
  const [newNetworkName, setNewNetworkName] = useState("");

  // Fetch networks
  const { data: networksData } = useQuery({
    queryKey: ["/api/jump-planner/beacons/networks"],
    queryFn: async () => {
      const res = await fetch("/api/jump-planner/beacons/networks");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      return json.networks as string[];
    },
    staleTime: 30 * 1000,
  });

  // Fetch beacons for selected network
  const { data: beaconsData } = useQuery({
    queryKey: ["/api/jump-planner/beacons", selectedNetwork],
    queryFn: async () => {
      const url = selectedNetwork
        ? `/api/jump-planner/beacons?network=${encodeURIComponent(selectedNetwork)}`
        : "/api/jump-planner/beacons";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      return json.beacons as Beacon[];
    },
    staleTime: 30 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newSystem) return;
      const res = await fetch("/api/jump-planner/beacons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemId: newSystem.id,
          systemName: newSystem.name,
          networkName: newNetworkName || selectedNetwork || "Default",
          beaconType: newType,
          notes: newNotes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jump-planner/beacons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jump-planner/beacons/networks"] });
      setNewSystem(null);
      setNewNotes("");
      setNewNetworkName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/jump-planner/beacons/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jump-planner/beacons"] });
    },
  });

  const networks = networksData || [];
  const beacons = beaconsData || [];

  return (
    <div className="space-y-2">
      {/* Network selector */}
      <div className="flex items-center gap-2">
        <Signal className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
        <Select value={selectedNetwork || "Default"} onValueChange={onNetworkChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Default">Default</SelectItem>
            {networks.filter((n) => n !== "Default").map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-sm">Add Beacon / Cyno Position</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <SystemSearch
                systems={systems}
                regions={regions}
                value={newSystem}
                onSelect={(id, name) => setNewSystem({ id, name })}
                placeholder="Search system..."
                label="System"
              />
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cyno_alt">Cyno Alt</SelectItem>
                    <SelectItem value="beacon">Ansiblex/Beacon</SelectItem>
                    <SelectItem value="structure">Citadel/Structure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Network Name</label>
                <Input
                  value={newNetworkName}
                  onChange={(e) => setNewNetworkName(e.target.value)}
                  placeholder={selectedNetwork || "Default"}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
                <Input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Alt name, docking access..."
                  className="h-8 text-sm"
                />
              </div>
              <Button
                className="w-full h-8 text-sm"
                onClick={() => {
                  addMutation.mutate();
                  setIsOpen(false);
                }}
                disabled={!newSystem}
              >
                Add Beacon
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Beacon count */}
      <div className="text-[10px] text-muted-foreground">
        {beacons.length} beacon{beacons.length !== 1 ? "s" : ""} in network
      </div>

      {/* Beacon list */}
      {beacons.length > 0 && (
        <ScrollArea className="max-h-[150px]">
          <div className="space-y-0.5">
            {beacons.map((beacon) => (
              <div
                key={beacon.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent/50 group text-xs"
              >
                <MapPin className="w-3 h-3 text-purple-400 flex-shrink-0" />
                <span className="font-medium truncate">{beacon.systemName}</span>
                <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                  {beacon.beaconType.replace("_", " ")}
                </Badge>
                {beacon.notes && (
                  <span className="text-muted-foreground truncate text-[10px]">{beacon.notes}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={() => deleteMutation.mutate(beacon.id)}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
