/*

Author : Rajveer Sharma
Date : 21 Nov 2026
@ Nxtwave

*/

"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DropdownOption } from "@/common/lib/options";
import { matchesSearch } from "@/common/lib/search";
import { zoomAnchor } from "@/common/lib/zoom-anchor";
import { cn } from "@/common/lib/utils";

export type { DropdownOption };

/** Lists longer than this get a search box at the top. */
const SEARCH_FROM = 10;

type DropdownProps = {
  options: readonly DropdownOption[];
  /** Controlled value; or leave it out and use `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * Form field name. The value is kept in a hidden input, and picking an option fires a bubbling
   * "input" event from it, so filter forms (LiveForm) apply at once, as with a native select.
   */
  name?: string;
  /** Search box in the list; on by default for lists longer than SEARCH_FROM. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown when the value matches no option. */
  placeholder?: string;
  disabled?: boolean;
  /** Classes for the button (width, height). */
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const TRIGGER =
  "inline-flex h-10 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm text-foreground outline-none transition-[color,background-color,box-shadow] select-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:ring-3 data-[popup-open]:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20";
const POPUP =
  "flex max-h-[min(22rem,var(--available-height))] min-w-[max(var(--anchor-width),11rem)] max-w-[min(28rem,calc(100vw-2rem))] origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-100 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0";
const LIST = "min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 outline-none";
const ITEM =
  "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:font-semibold";

/**
 * The app's dropdown: a button showing the choice and a list that opens under it, with a check on
 * the chosen option. Arrow keys, Enter, Esc and type-to-jump work as in a native select; long lists
 * get a search box. Works controlled (`value` + `onValueChange`) or in a plain form (`name`).
 */
export function Dropdown({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  searchable,
  searchPlaceholder = "Search…",
  placeholder = "Choose…",
  disabled,
  className,
  id,
  ...aria
}: DropdownProps) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  const selected = options.find((o) => o.value === current) ?? null;
  const hidden = useRef<HTMLInputElement>(null);
  const changed = useRef(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  // The list opens under the button, also under the page zoom (common/lib/zoom-anchor.ts).
  const anchor = useMemo(() => zoomAnchor(() => button), [button]);

  // Inside a <label>: name the button after it (a combobox doesn't take its name from a wrapping
  // label the way a native select does). Clicking the label text still opens the list.
  const ariaLabel = aria["aria-label"];
  useEffect(() => {
    const label = button?.closest("label");
    if (!button || !label || ariaLabel) return;
    if (!label.id) label.id = `${button.id || "dropdown"}-label`;
    button.setAttribute("aria-labelledby", label.id);
  }, [button, ariaLabel]);

  // Tell the enclosing form once the hidden input holds the new value.
  useEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [current]);

  function pick(next: string) {
    if (next === current) return;
    if (value === undefined) setInner(next);
    changed.current = true;
    onValueChange?.(next);
  }

  const trigger = cn(TRIGGER, className);
  const label = <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>;
  const chevron = <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
  const tick = <Check aria-hidden="true" className="size-4 shrink-0" />;
  const field = name ? <input ref={hidden} type="hidden" name={name} value={current} /> : null;

  if (searchable ?? options.length > SEARCH_FROM) {
    return (
      <>
        {field}
        <Combobox.Root
          items={options}
          value={selected}
          onValueChange={(o: DropdownOption | null) => o && pick(o.value)}
          itemToStringLabel={(o: DropdownOption) => o.label}
          filter={(o: DropdownOption, query: string) => matchesSearch(query, o.label)}
          isItemEqualToValue={(a: DropdownOption, b: DropdownOption) => a.value === b.value}
          disabled={disabled}
        >
          <Combobox.Trigger ref={setButton} id={id} className={trigger} {...aria}>
            {label}
            {chevron}
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner anchor={anchor} positionMethod="fixed" sideOffset={4} align="start" className="z-50">
              <Combobox.Popup className={POPUP}>
                <div className="flex items-center gap-2 border-b border-border px-3">
                  <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <Combobox.Input
                    placeholder={searchPlaceholder}
                    className="h-10 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <Combobox.Empty className="px-3 py-6 text-center text-[13px] text-muted-foreground empty:hidden">No matches</Combobox.Empty>
                <Combobox.List className={LIST}>
                  {(o: DropdownOption) => (
                    <Combobox.Item key={o.value} value={o} disabled={o.disabled} className={ITEM}>
                      <span className="flex-1 truncate">{o.label}</span>
                      <Combobox.ItemIndicator>{tick}</Combobox.ItemIndicator>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </>
    );
  }

  return (
    <>
      {field}
      <Select.Root
        items={options}
        value={selected ? selected.value : null}
        onValueChange={(v: string | null) => v !== null && pick(v)}
        disabled={disabled}
      >
        <Select.Trigger ref={setButton} id={id} className={trigger} {...aria}>
          {label}
          {chevron}
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner anchor={anchor} positionMethod="fixed" sideOffset={4} align="start" alignItemWithTrigger={false} className="z-50">
            <Select.Popup className={POPUP}>
              <Select.List className={LIST}>
                {options.map((o) => (
                  <Select.Item key={o.value} value={o.value} disabled={o.disabled} className={ITEM}>
                    <Select.ItemText className="flex-1 truncate">{o.label}</Select.ItemText>
                    <Select.ItemIndicator>{tick}</Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </>
  );
}
