import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEM1_META, DEM1_SECTIONS, DEM1_STATE_RESOLUTIONS, SOFTWARE_IDENTITY_CODES, STATE_PLACEHOLDER,
  resolveFacilityField, type FixtureEntity,
} from "@/lib/nemsis/fixtures/dem1";
import { DEM1_SUBMISSION_XML } from "@/lib/nemsis/fixtures/dem1-submission";

/** Facility rows grouped by the state id (dFacility.03) that precedes them. */
function facilityStateIdAt(entity: FixtureEntity, index: number): string | undefined {
  for (let i = index; i >= 0; i--) if (entity.fields[i].code === "dFacility.03") return entity.fields[i].value;
  return undefined;
}

export default function CreatorNemsisDem1() {
  const [copied, setCopied] = useState(false);
  const copyXml = async () => {
    await navigator.clipboard.writeText(DEM1_SUBMISSION_XML);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <CreatorLayout title="DEM 1 Fixture">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{DEM1_META.testCase}</CardTitle>
            <CardDescription>
              Schema {DEM1_META.schemaVersion} · expected {DEM1_META.expected} · read-only built-in test data, no company or patient data.{" "}
              <Link to="/creator-nemsis-cta" className="underline">Back to NEMSIS CTA</Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">PodDispatch identity — filled in by us</Badge>
            <Badge variant="destructive">From GA state registry</Badge>
            <Badge variant="outline">→ resolved value</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Generated DEM XML</CardTitle>
                <CardDescription>
                  Canonical DEM 1 submission payload, committed verbatim. The timestamp is a placeholder; the send path sets the real one at submission time.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={copyXml}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[600px] overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs whitespace-pre">{DEM1_SUBMISSION_XML}</pre>
          </CardContent>
        </Card>

        {DEM1_SECTIONS.map((sec) => (
          <Card key={sec.name}>
            <CardHeader><CardTitle className="text-base">{sec.name} <span className="text-muted-foreground font-normal">({sec.entities.length})</span></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {sec.entities.map((ent, ei) => (
                <div key={ei} className="rounded-md border border-border">
                  <div className="border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">Entity {ent.label}</div>
                  <table className="w-full text-sm">
                    <tbody>
                      {ent.fields.map((f, fi) => {
                        const isIdentity = SOFTWARE_IDENTITY_CODES.includes(f.code);
                        const isState = f.value.includes(STATE_PLACEHOLDER);
                        const stateId = sec.name === "dFacility" ? facilityStateIdAt(ent, fi) : undefined;
                        const resolved = isState && sec.name === "dFacility" ? resolveFacilityField(stateId, f.code) : [];
                        const agencyRef = sec.name === "dFacility" && f.code === "dFacility.03"
                          ? DEM1_STATE_RESOLUTIONS.find((r) => r.stateId === f.value && r.registry === "sAgency")
                          : undefined;
                        return (
                          <tr key={fi} className="border-b border-border last:border-0 align-top">
                            <td className="w-8 px-3 py-1 text-xs text-muted-foreground">{fi + 1}</td>
                            <td className="w-40 px-2 py-1 font-mono text-xs">{f.code}</td>
                            <td className="px-2 py-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={isState ? "font-mono text-xs text-destructive" : ""}>{f.value}</span>
                                {isIdentity && <Badge variant="secondary">PodDispatch identity</Badge>}
                                {isState && <Badge variant="destructive">GA state registry</Badge>}
                                {isState && resolved.map((v, i) => <Badge key={i} variant="outline">→ {v}</Badge>)}
                                {isState && sec.name === "dFacility" && resolved.length === 0 && <span className="text-xs text-muted-foreground">no resolution provided</span>}
                                {isState && f.code === "dAgency.03" && <span className="text-xs text-muted-foreground">state org id — no resolution provided yet</span>}
                                {agencyRef && (
                                  <span className="text-xs">
                                    <Badge variant="destructive">State AGENCY registry, not facility</Badge>{" "}
                                    {agencyRef.fields.map((x) => `${x.code}=${x.value}`).join(" · ")}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader><CardTitle className="text-base">State registry resolutions (source)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {DEM1_STATE_RESOLUTIONS.map((r) => (
              <div key={r.stateId}>
                <div className="font-medium">{r.stateId} — {r.name} <Badge variant="outline">{r.registry}</Badge></div>
                <div className="font-mono text-xs text-muted-foreground">{r.fields.map((f) => `${f.code}=${f.value}`).join("  ")}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </CreatorLayout>
  );
}
