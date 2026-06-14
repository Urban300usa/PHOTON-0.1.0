export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">PHOTON</span>
            <span>&copy; {currentYear} All rights reserved.</span>
          </div>

          <div className="text-center md:text-right max-w-2xl">
            <p>
              EVE Online and the EVE logo are the registered trademarks of CCP hf.
              All rights are reserved worldwide. All other trademarks are the property of their respective owners.
              EVE Online, the EVE logo, EVE and all associated logos and designs are the intellectual property of CCP hf.
            </p>
            <p className="mt-1">
              This application is not affiliated with or endorsed by CCP hf.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
