/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-3xl flex-col gap-1">
        {eyebrow ? <span className="text-[13px] text-muted-foreground">{eyebrow}</span> : null}
        <h1 className="text-[30px] leading-tight font-semibold">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-end gap-2.5">{actions}</div> : null}
    </header>
  );
}
