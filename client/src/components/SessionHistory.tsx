import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { History, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Session {
  id: string;
  date: Date;
  duration: number;
  totalIsk: number;
  iskPerHour: number;
  kills: number;
}

interface SessionHistoryProps {
  sessions?: Session[];
  onDeleteSession?: (id: string) => void;
  limitedMode?: boolean;
}

type SortField = 'date' | 'duration' | 'totalIsk' | 'iskPerHour' | 'kills';
type SortDirection = 'asc' | 'desc';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatISK(value: number): string {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + "B";
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  return value.toLocaleString();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function SessionHistory({ 
  sessions = [], 
  onDeleteSession,
  limitedMode = false
}: SessionHistoryProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'date':
        return (a.date.getTime() - b.date.getTime()) * modifier;
      case 'duration':
        return (a.duration - b.duration) * modifier;
      case 'totalIsk':
        return (a.totalIsk - b.totalIsk) * modifier;
      case 'iskPerHour':
        return (a.iskPerHour - b.iskPerHour) * modifier;
      case 'kills':
        return (a.kills - b.kills) * modifier;
      default:
        return 0;
    }
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover-elevate"
      onClick={() => handleSort(field)}
      data-testid={`header-sort-${field}`}
    >
      {children}
      <SortIcon field={field} />
    </TableHead>
  );

  return (
    <Card className="p-6" data-testid="session-history">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Session History
          {limitedMode && (
            <Badge variant="secondary" className="text-xs">
              Last 3 Only
            </Badge>
          )}
        </h3>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No sessions recorded yet</p>
          <p className="text-sm mt-1">Start your first ratting session to see history here</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="date">Date</SortableHeader>
                  <SortableHeader field="duration">Duration</SortableHeader>
                  <SortableHeader field="totalIsk">Total ISK</SortableHeader>
                  <SortableHeader field="iskPerHour">ISK/Hour</SortableHeader>
                  <SortableHeader field="kills">Kills</SortableHeader>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSessions.map((session) => (
                  <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                    <TableCell className="font-medium">{formatDate(session.date)}</TableCell>
                    <TableCell className="font-mono">{formatDuration(session.duration)}</TableCell>
                    <TableCell className="font-mono text-green-400">{formatISK(session.totalIsk)} ISK</TableCell>
                    <TableCell className="font-mono">{formatISK(session.iskPerHour)}/hr</TableCell>
                    <TableCell>{session.kills}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteSession?.(session.id)}
                        data-testid={`button-delete-session-${session.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}
