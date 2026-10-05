import { normalizeTransportKind as nt, resolveTransportKind as rt } from "/dev-server/src/lib/transport-vocabulary";
import { normalizePayerClass as np } from "/dev-server/src/lib/payer-class";
import fs from "fs";
const rd=(f)=>fs.readFileSync(f,"utf8").trim().split("\n").filter(Boolean).map(l=>l.split("\t"));
const P=rd("p.tsv"),L=rd("l.tsv"),T=rd("t.tsv");const pp=Object.fromEntries(P.map(r=>[r[0],r[3]]));
const exp={p:Object.fromEntries(P.map(r=>[r[0],[nt(r[2])+"",np(r[3])+""]])),
 l:Object.fromEntries(L.map(r=>[r[0],[nt(r[2])+"",(np(r[3])??np(pp[r[4]]))+""]])),
 t:Object.fromEntries(T.map(r=>[r[0],[rt({trip_type:r[2],pcr_type:r[3],patient_transport_type:r[5]})+"",(np(r[4])??np(r[6]))+""]]))};
for(const [k,f] of [["p","pn.tsv"],["l","ln.tsv"],["t","tn.tsv"]]){const rows=rd(f);let mis=0;const tk={},pc={};
 for(const [id,a,b] of rows){const e=exp[k][id];if(!e||e[0]!==a||e[1]!==b){mis++;console.log("MISMATCH",k,id,a,b,e)}tk[a]=(tk[a]||0)+1;pc[b]=(pc[b]||0)+1}
 console.log(k,"rows",rows.length,"mismatches",mis,"transport",JSON.stringify(tk),"payer",JSON.stringify(pc))}
