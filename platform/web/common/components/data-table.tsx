/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/common/lib/utils";
import { EmptyState } from "@/common/components/empty-state";

/**
 * Shared table (UI plan UI-0). Client-side sorting for small sets; large lists
 * (students, contest results) will switch to server-side sorting and virtual rows
 * in UI-2 / UI-5 without changing the call sites.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  minWidth = 760,
  emptyTitle = "Nothing to show",
  emptyDescription,
  caption,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  minWidth?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is not compiler-memoizable; this component is not compiled.
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="bg-surface-subtle text-left text-xs text-muted-foreground">
              {group.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                    className="border-b border-border px-3 py-2.5 font-semibold first:pl-5 last:pr-5"
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="-mx-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 hover:text-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {dir === "asc" ? (
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        ) : dir === "desc" ? (
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-subtle">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    "border-b border-muted px-3 py-3 align-middle first:pl-5 last:pr-5",
                    // Optional per-column cell classes: columnDef.meta = { cellClassName: "..." }.
                    (cell.column.columnDef.meta as { cellClassName?: string } | undefined)?.cellClassName,
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
