import { useState, useEffect, useCallback } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import { GripVertical, Lock, Unlock, RotateCcw, Move, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProContext } from "@/contexts/ProContext";

interface DashboardTile {
  id: string;
  title: string;
  component: React.ReactNode;
  defaultLayout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
  };
}

interface DashboardGridProps {
  tiles: DashboardTile[];
  columns?: number;
  rowHeight?: number;
  headerContent?: React.ReactNode;
}

const LAYOUT_STORAGE_KEY = "eve-ratting-dashboard-layout-v7";

export default function DashboardGrid({ 
  tiles, 
  columns = 12,
  rowHeight = 40,
  headerContent
}: DashboardGridProps) {
  const { isPro } = useProContext();
  const [isLocked, setIsLocked] = useState(true);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [layout, setLayout] = useState<Layout[]>(() => {
    // Clear old layout key
    localStorage.removeItem("eve-ratting-dashboard-layout");
    
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Deduplicate by id and filter to only valid tiles
        const tileIds = new Set(tiles.map(t => t.id));
        const seen = new Set<string>();
        const deduplicated = parsed.filter((l: Layout) => {
          if (seen.has(l.i) || !tileIds.has(l.i)) return false;
          seen.add(l.i);
          return true;
        });
        return deduplicated;
      } catch {
        return tiles.map(tile => ({
          i: tile.id,
          ...tile.defaultLayout
        }));
      }
    }
    return tiles.map(tile => ({
      i: tile.id,
      ...tile.defaultLayout
    }));
  });

  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById("dashboard-grid-container");
      if (container) {
        setContainerWidth(container.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const tileIds = new Set(tiles.map(t => t.id));
    const existingIds = new Set(layout.map(l => l.i));
    
    // Add missing tiles
    const missingTiles = tiles.filter(t => !existingIds.has(t.id));
    
    // Remove tiles that no longer exist and deduplicate
    const seen = new Set<string>();
    const validLayout = layout.filter(l => {
      if (seen.has(l.i) || !tileIds.has(l.i)) return false;
      seen.add(l.i);
      return true;
    });
    
    if (missingTiles.length > 0 || validLayout.length !== layout.length) {
      const newLayouts = missingTiles.map(tile => ({
        i: tile.id,
        ...tile.defaultLayout
      }));
      setLayout([...validLayout, ...newLayouts]);
    }
  }, [tiles, layout]);

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout);
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout));
  }, []);

  const handleResetLayout = useCallback(() => {
    const defaultLayout = tiles.map(tile => ({
      i: tile.id,
      ...tile.defaultLayout
    }));
    setLayout(defaultLayout);
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
  }, [tiles]);

  // Non-PRO users cannot customize the layout
  const canCustomize = isPro;
  const effectivelyLocked = !canCustomize || isLocked;

  return (
    <div id="dashboard-grid-container" className="w-full">
      <div className="flex items-center justify-end gap-2 mb-4 flex-wrap">
        {headerContent}
        {canCustomize ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetLayout}
              data-testid="button-reset-layout"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Layout
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLocked(!isLocked)}
              data-testid="button-toggle-lock"
            >
              {isLocked ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Unlock to Edit
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4 mr-2" />
                  Lock Layout
                </>
              )}
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Lock className="w-3 h-3" />
            Layout Locked
          </Badge>
        )}
      </div>

      <GridLayout
        className={`layout ${effectivelyLocked ? 'layout-locked' : 'layout-unlocked'}`}
        layout={layout}
        cols={columns}
        rowHeight={rowHeight}
        width={containerWidth}
        onLayoutChange={handleLayoutChange}
        isDraggable={!effectivelyLocked}
        isResizable={!effectivelyLocked}
        resizeHandles={effectivelyLocked ? [] : ['se']}
        draggableHandle=".drag-handle"
        margin={[16, 16]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
      >
        {tiles.map(tile => (
          <div key={tile.id} className="h-full">
            <Card 
              className="h-full flex flex-col overflow-hidden"
              data-testid={`${tile.id}-card`}
            >
              {!effectivelyLocked && (
                <div className="drag-handle flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b cursor-move">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">{tile.title}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground/60">
                    <Move className="w-3 h-3" />
                    <Maximize2 className="w-3 h-3" />
                  </div>
                </div>
              )}
              <div className={`flex-1 ${effectivelyLocked ? 'overflow-hidden' : 'overflow-auto'}`}>
                {tile.component}
              </div>
            </Card>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
