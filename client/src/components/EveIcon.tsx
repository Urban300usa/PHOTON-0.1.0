import { useState } from "react";
import { Package } from "lucide-react";

interface EveIconProps {
  typeId: number;
  size?: 32 | 64 | 128 | 256 | 512;
  variant?: "icon" | "render" | "bp" | "bpc" | "relic";
  className?: string;
  alt?: string;
  showFallback?: boolean;
}

export function EveIcon({
  typeId,
  size = 32,
  variant = "icon",
  className = "",
  alt = "EVE item",
  showFallback = true,
}: EveIconProps) {
  const [hasError, setHasError] = useState(false);

  if (!typeId || hasError) {
    if (!showFallback) return null;
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <Package className="w-1/2 h-1/2 text-muted-foreground" />
      </div>
    );
  }

  const url = `https://images.evetech.net/types/${typeId}/${variant}?size=${size}`;

  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

interface EveCharacterPortraitProps {
  characterId: number;
  size?: 32 | 64 | 128 | 256 | 512 | 1024;
  className?: string;
}

export function EveCharacterPortrait({
  characterId,
  size = 64,
  className = "",
}: EveCharacterPortraitProps) {
  const [hasError, setHasError] = useState(false);

  if (!characterId || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-full ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const url = `https://images.evetech.net/characters/${characterId}/portrait?size=${size}`;

  return (
    <img
      src={url}
      alt="Character portrait"
      width={size}
      height={size}
      className={`object-cover rounded-full ${className}`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

interface EveCorporationLogoProps {
  corporationId: number;
  size?: 32 | 64 | 128 | 256;
  className?: string;
}

export function EveCorporationLogo({
  corporationId,
  size = 64,
  className = "",
}: EveCorporationLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (!corporationId || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const url = `https://images.evetech.net/corporations/${corporationId}/logo?size=${size}`;

  return (
    <img
      src={url}
      alt="Corporation logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

interface EveAllianceLogoProps {
  allianceId: number;
  size?: 32 | 64 | 128 | 256;
  className?: string;
}

export function EveAllianceLogo({
  allianceId,
  size = 64,
  className = "",
}: EveAllianceLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (!allianceId || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const url = `https://images.evetech.net/alliances/${allianceId}/logo?size=${size}`;

  return (
    <img
      src={url}
      alt="Alliance logo"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
