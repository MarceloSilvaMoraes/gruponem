import { LucideIcon } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="p-6 md:p-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>
      <div className="mt-8 rounded-xl border border-dashed bg-card/50 p-16 flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-medium">Em breve</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Esta seção está sendo preparada. Em breve você poderá gerenciar {title.toLowerCase()} por aqui.
        </p>
      </div>
    </div>
  );
}