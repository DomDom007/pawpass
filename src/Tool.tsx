// Pawpass: a pet's health passport in one link or QR tag: vaccines, vet, feeding and medicine notes for sitters and travel.
import { useState } from "react";
import { downloadIcs, localDate } from "./lib/ics";
import { shareLink } from "./lib/share";
import { uid, useStored } from "./lib/store";
import { useShared } from "./lib/useShared";
import { addDays, prettyDate, todayISO } from "./lib/time";
import { Section, ShareBox, Stat, Stats } from "./ui/kit";
import { QR } from "./ui/QR";

const T = "pawpass";
type Vax = { id: string; name: string; given: string; due: string };
type Pet = { id: string; name: string; species: string; breed: string; born: string; weight: string; chip: string; colour: string; owner: string; ownerPhone: string; vet: string; vetPhone: string; food: string; meds: string; quirks: string; vax: Vax[] };
const SAMPLE: Pet[] = [{
  id: "p1", name: "Simba", species: "Dog", breed: "Mixed, shepherd type", born: "2021-04-10", weight: "24 kg", chip: "788 0981 0000 1234", colour: "Tan with black muzzle", owner: "Leila Haddad", ownerPhone: "+216 22 000 111", vet: "Clinique Vétérinaire du Lac", vetPhone: "+216 71 000 222",
  food: "2 cups of dry food at 7:00 and 19:00. No chicken bones. A carrot counts as a treat.", meds: "Joint supplement, one tablet with breakfast.", quirks: "Scared of scooters. Pulls towards cats. Sleeps on his own blanket only.",
  vax: [{ id: "v1", name: "Rabies", given: "2025-11-02", due: "2026-11-02" }, { id: "v2", name: "DHPP", given: "2025-11-02", due: "2026-11-02" }, { id: "v3", name: "Deworming", given: addDays(todayISO(), -100), due: addDays(todayISO(), -10) }, { id: "v4", name: "Flea and tick", given: addDays(todayISO(), -25), due: addDays(todayISO(), 5) }],
}];
const age = (born: string) => { const y = (Date.now() - new Date(born).getTime()) / 3.156e10; return y >= 1 ? `${Math.floor(y)} years` : `${Math.round(y * 12)} months`; };
const status = (due: string) => { const d = Math.round((new Date(due).getTime() - new Date(todayISO()).getTime()) / 86400000); return d < 0 ? ["Overdue", "bad"] : d <= 30 ? [`Due in ${d} days`, "warn"] : [`Due ${prettyDate(due)}`, "good"]; };

function Card({ p }: { p: Pet }) {
  return (
    <article className="pw-card">
      <header><div><p className="eyebrow">Pet passport</p><h2>{p.name}</h2><p>{p.species} · {p.breed} · {age(p.born)} · {p.weight}</p></div><div className="pw-chip"><span>Microchip</span><strong>{p.chip || "None"}</strong></div></header>
      <div className="pw-grid">
        <div><p className="eyebrow">If found, call</p><p><strong>{p.owner}</strong><br /><a href={`tel:${p.ownerPhone.replace(/\s/g, "")}`}>{p.ownerPhone}</a></p></div>
        <div><p className="eyebrow">Vet</p><p>{p.vet}<br /><a href={`tel:${p.vetPhone.replace(/\s/g, "")}`}>{p.vetPhone}</a></p></div>
      </div>
      <div><p className="eyebrow">Feeding</p><p>{p.food}</p></div>
      {p.meds && <div><p className="eyebrow">Medicines</p><p>{p.meds}</p></div>}
      {p.quirks && <div><p className="eyebrow">Good to know</p><p>{p.quirks}</p></div>}
      <div><p className="eyebrow">Vaccines and treatments</p><table className="t"><tbody>{p.vax.map(v => { const s = status(v.due); return <tr key={v.id}><td>{v.name}</td><td className="num">{v.given}</td><td><span className={"pill " + s[1]}>{s[0]}</span></td></tr>; })}</tbody></table></div>
    </article>
  );
}

export default function Pawpass() {
  const shared = useShared<Pet>();
  const [pets, setPets] = useStored<Pet[]>(T, "pets", SAMPLE);
  const [openId, setOpenId] = useState(pets[0]?.id ?? "");
  const [tag, setTag] = useState("");
  const css = <style>{`.pw-card{background:var(--surface);border-radius:16px;box-shadow:var(--shadow);padding:22px;display:grid;gap:14px}.pw-card header{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.pw-card h2{font-size:clamp(36px,5vw,54px);line-height:1}
  .pw-chip{background:var(--sunk);border-radius:10px;padding:10px 14px;display:grid}.pw-chip span{font-family:var(--mono);font-size:11px;text-transform:uppercase;color:var(--muted)}.pw-chip strong{font-family:var(--mono)}.pw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
  .pw-tag{background:#fff;color:#151933;border:2px solid #151933;border-radius:50%;width:200px;height:200px;display:grid;place-items:center;text-align:center;padding:18px}.pw-tag b{font-family:var(--serif);font-weight:400;font-size:20px}`}</style>;
  if (shared.loading) return <p className="empty-note">Opening passport…</p>;
  if (shared.data) return <div className="stack">{css}<Card p={shared.data} /><p className="note">Shared with Pawpass. Details are as of when the link was made.</p></div>;

  const p = pets.find(x => x.id === openId) ?? pets[0];
  const set = (patch: Partial<Pet>) => { setPets(pets.map(x => (x.id === p.id ? { ...x, ...patch } : x))); setTag(""); };
  const due = pets.flatMap(x => x.vax.map(v => ({ pet: x.name, ...v }))).filter(v => status(v.due)[1] !== "good");
  const field = (k: keyof Pet, label: string, area = false) => <label className="field"><span>{label}</span>{area ? <textarea className="input" rows={2} value={p[k] as string} onChange={e => set({ [k]: e.target.value } as Partial<Pet>)} /> : <input className="input" value={p[k] as string} onChange={e => set({ [k]: e.target.value } as Partial<Pet>)} />}</label>;

  return (
    <div className="stack">{css}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="seg-mini">{pets.map(x => <button key={x.id} aria-pressed={x.id === p?.id} onClick={() => setOpenId(x.id)}>{x.name}</button>)}</div>
        <button className="btn small" onClick={() => { const n: Pet = { ...SAMPLE[0], id: uid(), name: "New pet", chip: "", food: "", meds: "", quirks: "", vax: [] }; setPets([...pets, n]); setOpenId(n.id); }}>Add a pet</button>
      </div>
      <Section title="Coming due" aside={<button className="btn small" onClick={() => downloadIcs("pet-reminders.ics", pets.flatMap(x => x.vax.map(v => ({ title: `${x.name}: ${v.name} due`, start: localDate(v.due < todayISO() ? todayISO() : v.due), allDay: true, alarmMinutes: 0 }))), "Pet care")}>Reminders to calendar</button>}>
        <Stats><Stat value={pets.length} label="Pets" /><Stat value={due.filter(v => status(v.due)[1] === "bad").length} label="Overdue" tone="bad" /><Stat value={due.filter(v => status(v.due)[1] === "warn").length} label="Due within 30 days" tone="warn" /></Stats>
        {due.length > 0 && <div className="row" style={{ gap: 6, marginTop: 10 }}>{due.map(v => <span key={v.pet + v.id} className={"pill " + status(v.due)[1]}>{v.pet}: {v.name}, {status(v.due)[0].toLowerCase()}</span>)}</div>}
      </Section>
      {p && <>
        <div className="grid2">
          <Section title="Details">
            <div className="stack" style={{ gap: 10 }}>
              <div className="row">{field("name", "Name")}{field("species", "Species")}{field("breed", "Breed")}</div>
              <div className="row"><label className="field"><span>Born</span><input type="date" className="input" value={p.born} onChange={e => set({ born: e.target.value })} /></label>{field("weight", "Weight")}{field("colour", "Colour")}</div>
              {field("chip", "Microchip number")}
              <div className="row">{field("owner", "Owner")}{field("ownerPhone", "Owner phone")}</div>
              <div className="row">{field("vet", "Vet")}{field("vetPhone", "Vet phone")}</div>
              {field("food", "Feeding", true)}{field("meds", "Medicines", true)}{field("quirks", "Good to know", true)}
            </div>
          </Section>
          <div className="stack">
            <Section title="Vaccines and treatments">
              {p.vax.map(v => <div key={v.id} className="row" style={{ marginBottom: 6, alignItems: "center" }}><input className="input" style={{ flex: 2 }} aria-label="Name" value={v.name} onChange={e => set({ vax: p.vax.map(x => x.id === v.id ? { ...x, name: e.target.value } : x) })} /><input type="date" className="input" style={{ flex: 1 }} aria-label="Given" value={v.given} onChange={e => set({ vax: p.vax.map(x => x.id === v.id ? { ...x, given: e.target.value } : x) })} /><input type="date" className="input" style={{ flex: 1 }} aria-label="Due" value={v.due} onChange={e => set({ vax: p.vax.map(x => x.id === v.id ? { ...x, due: e.target.value } : x) })} /><button className="btn ghost small danger" onClick={() => set({ vax: p.vax.filter(x => x.id !== v.id) })}>×</button></div>)}
              <button className="btn small" onClick={() => set({ vax: [...p.vax, { id: uid(), name: "New", given: todayISO(), due: addDays(todayISO(), 365) }] })}>Add</button>
            </Section>
            <Section title="Share with a sitter"><ShareBox slug={T} data={p} label="Copy passport link" message={`${p.name}'s details for while we're away:`} /></Section>
            <Section title="Collar tag QR">
              {!tag ? <button className="btn" onClick={async () => setTag(await shareLink(T, p, "m=tag"))}>Make a printable tag</button> : tag.length < 2300 ? <div className="row" style={{ gap: 20, alignItems: "center" }}><div className="pw-tag"><div><QR text={tag} size={110} /><b>{p.name}</b></div></div><button className="btn small" onClick={() => window.print()}>Print</button></div> : <p className="pill warn">Too much text for a small QR. Shorten the notes, or share the link instead.</p>}
            </Section>
          </div>
        </div>
        <Card p={p} />
      </>}
    </div>
  );
}
