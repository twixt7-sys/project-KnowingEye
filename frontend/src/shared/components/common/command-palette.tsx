import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  examinerNav,
  examinerQuickActions,
} from "../../../core/config/examiner-nav";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../ui/command";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette">
      <CommandInput placeholder="Search pages and actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {examinerNav.map((item) => (
            <CommandItem
              key={item.path}
              value={`${item.label} ${item.description ?? ""}`}
              onSelect={() => go(item.path)}
            >
              <item.icon />
              <span>{item.label}</span>
              {item.description && (
                <span className="text-muted-foreground ml-2 truncate text-xs">
                  {item.description}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        {examinerQuickActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick actions">
              {examinerQuickActions.map((item) => (
                <CommandItem
                  key={item.path}
                  value={item.label}
                  onSelect={() => go(item.path)}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Shortcuts">
          <CommandItem disabled>
            <span>Open command palette</span>
            <CommandShortcut>Ctrl K</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
