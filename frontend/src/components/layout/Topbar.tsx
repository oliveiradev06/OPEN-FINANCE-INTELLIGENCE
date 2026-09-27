"use client";

import { GlobalSearch } from "./GlobalSearch";
import { NotificationsMenu, PrivacyMenu, StatusMenu, UserMenu } from "./TopbarMenus";

export function Topbar({ leading }: { leading?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-topbar/95 backdrop-blur-md">
      <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        {leading}
        <GlobalSearch />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-1 sm:flex">
            <StatusMenu />
            <NotificationsMenu />
            <PrivacyMenu />
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
