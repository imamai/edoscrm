import { Phone, Mail, MessageCircle, Footprints, Globe, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/data/complaints";

const CHANNEL: Record<Channel, { label: string; icon: typeof Phone }> = {
  internal: { label: "Internal", icon: Building2 },
  web: { label: "Website", icon: Globe },
  phone: { label: "Phone", icon: Phone },
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  walk_in: { label: "Walk-in", icon: Footprints },
};

export function ChannelBadge({ channel, className }: { channel: Channel; className?: string }) {
  const { label, icon: Icon } = CHANNEL[channel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-ink-faint",
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
