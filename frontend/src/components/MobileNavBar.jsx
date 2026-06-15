import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

/**
 * Mobile top bar with hamburger that opens a left drawer.
 * Reused by AdminLayout & StudentLayout.
 *
 * Props: brand (string), subtitle, items: [{ to, label, Icon, end, id }], footer (ReactNode)
 */
export default function MobileNavBar({ brand, subtitle, items, footer, footerTestIdPrefix = "mobile" }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-sm shrink-0">
          {/* Use a simple letter mark */}
          <span className="font-bold text-sm">G</span>
        </div>
        <div className="min-w-0">
          <div className="heading font-bold leading-none text-sm truncate">{brand}</div>
          <div className="overline text-[9px] mt-0.5">{subtitle}</div>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-sm" data-testid="mobile-menu-btn">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-card">
          <div className="flex flex-col h-full">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <div className="heading font-bold leading-none">{brand}</div>
                <div className="overline text-[10px] mt-1">{subtitle}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-sm">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {items.map(({ to, label, Icon, end, id }) => (
                <NavLink key={to} to={to} end={end} data-testid={`m-${id}`} onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors ${
                      isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-foreground"
                    }`}>
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-border">{footer}</div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
