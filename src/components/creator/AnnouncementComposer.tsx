import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, Trash2, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "owner", label: "Owners" },
  { value: "manager", label: "Managers" },
  { value: "dispatcher", label: "Dispatchers" },
  { value: "biller", label: "Billers" },
  { value: "crew", label: "Crew" },
];

export function AnnouncementComposer() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tier, setTier] = useState<"action" | "fyi" | "system">("system");
  const [link, setLink] = useState("");
  const [roles, setRoles] = useState<string[]>(["owner", "manager", "dispatcher", "biller", "crew"]);
  const [isProductUpdate, setIsProductUpdate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("system_announcements" as any)
      .select("id, title, tier, published_at, expires_at, audience_roles, category")
      .order("published_at", { ascending: false })
      .limit(10);
    setRecent(data ?? []);
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const toggleRole = (value: string) => {
    setRoles((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]));
  };

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required.");
      return;
    }
    if (roles.length === 0) {
      toast.error("Pick at least one audience role.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("system_announcements" as any).insert({
      title: title.trim(),
      body: body.trim(),
      tier: isProductUpdate ? "system" : tier,
      category: isProductUpdate ? "product_update" : null,
      link: link.trim() || null,
      audience_roles: roles,
      created_by: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      isProductUpdate
        ? "Product update published — landed in every user's bell under Product Updates."
        : "Announcement published to every tenant."
    );
    setTitle("");
    setBody("");
    setLink("");
    setIsProductUpdate(false);
    loadRecent();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("system_announcements" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Announcement deleted.");
    loadRecent();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Broadcast Announcement
          </CardTitle>
          <CardDescription className="text-xs">
            Publish a plain-English message that lands in the notification bell of every targeted user across every tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title" className="text-xs">Title</Label>
            <Input
              id="ann-title"
              placeholder="PodDispatch v2.4 — what's new"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <label className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs cursor-pointer hover:bg-muted/40">
            <Checkbox
              checked={isProductUpdate}
              onCheckedChange={(v) => setIsProductUpdate(!!v)}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Mark as Product Update
              </span>
              <span className="text-muted-foreground">
                Lands in a dedicated "Product Updates" group inside every user's bell — use for release notes, new features, breaking changes.
              </span>
            </span>
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body" className="text-xs">Body</Label>
            <Textarea
              id="ann-body"
              placeholder="Plain English. Explain what changed, why it matters, and what (if anything) the user needs to do."
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tier</Label>
              <Select
                value={tier}
                onValueChange={(v) => setTier(v as any)}
                disabled={isProductUpdate}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System — pinned, low urgency</SelectItem>
                  <SelectItem value="fyi">FYI — grey dot</SelectItem>
                  <SelectItem value="action">Action Required — red, pulses</SelectItem>
                </SelectContent>
              </Select>
              {isProductUpdate && (
                <p className="text-[10px] text-muted-foreground">Locked to System tier for updates.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-link" className="text-xs">Optional link</Label>
              <Input
                id="ann-link"
                placeholder="/billing or full URL"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Audience roles</Label>
            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={roles.includes(r.value)}
                    onCheckedChange={() => toggleRole(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={publish} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Publishing…" : "Publish to all tenants"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No announcements yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 rounded border p-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.category === "product_update" ? (
                        <Badge className="text-[9px] uppercase gap-1">
                          <Sparkles className="h-2.5 w-2.5" />Update
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] uppercase">{r.tier}</Badge>
                      )}
                      <span className="text-sm font-medium truncate">{r.title}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(r.published_at), { addSuffix: true })} · {(r.audience_roles ?? []).join(", ")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}