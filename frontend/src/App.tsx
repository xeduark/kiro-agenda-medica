import { useEffect, useState, type FormEvent } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type Item = { id: string; full_name: string; specialty?: string; document_id?: string; phone?: string | null; email?: string | null };
type Appt = { id: string; starts_at: string; ends_at: string; patient_id: string; status: "confirmed" | "completed" | "cancelled" };
type View = "agenda" | "medicos" | "pacientes";

const NAV: { id: View; label: string; icon: string; title: string; sub: string }[] = [
  { id: "agenda", label: "Agenda", icon: "▦", title: "Agenda", sub: "Agenda citas sin dobles reservas." },
  { id: "medicos", label: "Médicos", icon: "✚", title: "Médicos", sub: "Registra y consulta los médicos del consultorio." },
  { id: "pacientes", label: "Pacientes", icon: "☺", title: "Pacientes", sub: "Registra, consulta y edita pacientes." },
];

export default function App() {
  const [view, setView] = useState<View>("agenda");
  const [doctors, setDoctors] = useState<Item[]>([]);
  const [patients, setPatients] = useState<Item[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [agenda, setAgenda] = useState<Appt[]>([]);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadLists = () => {
    fetch(`${API}/doctors`).then((r) => r.json()).then((d: Item[]) => { setDoctors(d); setDoctorId((cur) => cur || (d[0]?.id ?? "")); });
    fetch(`${API}/patients`).then((r) => r.json()).then((p: Item[]) => { setPatients(p); setPatientId((cur) => cur || (p[0]?.id ?? "")); });
  };
  useEffect(loadLists, []);

  const loadAgenda = () => {
    if (doctorId) fetch(`${API}/doctors/${doctorId}/appointments?date=${date}`).then((r) => r.json()).then(setAgenda);
  };
  useEffect(loadAgenda, [doctorId, date]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    const res = await fetch(`${API}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorId: Number(doctorId),
        patientId: Number(patientId),
        startsAt: new Date(`${date}T${start}`).toISOString(),
        endsAt: new Date(`${date}T${end}`).toISOString(),
      }),
    });
    const body = await res.json();
    setMsg(res.ok ? { ok: true, text: "Cita agendada correctamente." } : { ok: false, text: body.error });
    setSending(false);
    if (res.ok) loadAgenda();
  }

  async function closeAppt(a: Appt, status: "completed" | "cancelled") {
    const verb = status === "cancelled" ? "cancelar" : "marcar como atendida";
    if (!window.confirm(`¿Seguro que quieres ${verb} la cita de ${name(a.patient_id)} a las ${time(a.starts_at)}?`)) return;
    const res = await fetch(`${API}/appointments/${a.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await res.json();
    setMsg(res.ok ? { ok: true, text: status === "cancelled" ? "Cita cancelada. El horario quedó libre." : "Cita marcada como atendida." } : { ok: false, text: body.error });
    loadAgenda();
  }

  const time = (s: string) => new Date(s).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const name = (id: string) => patients.find((p) => p.id === id)?.full_name ?? id;

  const doctor = doctors.find((d) => d.id === doctorId);
  const longDate = new Date(`${date}T12:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const current = NAV.find((n) => n.id === view)!;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo" aria-hidden="true">+</div>
          <div>
            <strong>Agenda médica</strong>
            <small>Consultorio</small>
          </div>
        </div>
        <nav aria-label="Secciones">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`nav-item${view === n.id ? " active" : ""}`}
              aria-current={view === n.id ? "page" : undefined}
              aria-label={n.label}
              onClick={() => setView(n.id)}
            >
              <span aria-hidden="true">{n.icon}</span>
              <em>{n.label}</em>
            </button>
          ))}
        </nav>
      </aside>

      <div className="content">
        <header className="topbar">
          <h1>{current.title}</h1>
          <p>{current.sub}</p>
        </header>

        <div className="stats">
          <div className="stat"><span>Médicos</span><strong>{doctors.length}</strong></div>
          <div className="stat"><span>Pacientes</span><strong>{patients.length}</strong></div>
          <div className="stat"><span>Citas del día</span><strong>{agenda.length}</strong></div>
        </div>

        {view === "agenda" && (
          <main className="layout">
            <section className="card" aria-labelledby="form-title">
              <h2 id="form-title">Nueva cita</h2>
              <p className="sub">Elige médico, paciente y horario.</p>
              <form onSubmit={submit}>
                <label>Médico
                  <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </label>
                <label>Paciente
                  <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </label>
                <label>Fecha
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </label>
                <div className="row">
                  <label>Inicio
                    <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
                  </label>
                  <label>Fin
                    <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
                  </label>
                </div>
                <button type="submit" disabled={sending}>{sending ? "Agendando…" : "Agendar cita"}</button>
              </form>
              {msg && <p role="alert" className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
            </section>

            <section className="card" aria-labelledby="agenda-title">
              <div className="agenda-head">
                <div>
                  <h2 id="agenda-title">Agenda del día</h2>
                  <p className="sub" style={{ margin: 0 }}>{doctor?.full_name ?? "—"} · {longDate}</p>
                </div>
                <span className="badge">{agenda.length} {agenda.length === 1 ? "cita" : "citas"}</span>
              </div>
              {agenda.length === 0 ? (
                <p className="empty">No hay citas para este día.</p>
              ) : (
                <ul className="slots">
                  {agenda.map((a) => (
                    <li key={a.id} className={`slot ${a.status}`}>
                      <time dateTime={a.starts_at}>{time(a.starts_at)} – {time(a.ends_at)}</time>
                      <span>{name(a.patient_id)}</span>
                      {a.status === "confirmed" ? (
                        <div className="slot-actions">
                          <button type="button" className="btn-sm" onClick={() => closeAppt(a, "completed")}>Atendida</button>
                          <button type="button" className="btn-sm ghost" onClick={() => closeAppt(a, "cancelled")}>Cancelar</button>
                        </div>
                      ) : (
                        <em className="status-tag">Atendida</em>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </main>
        )}

        {view === "medicos" && (
          <main className="layout">
            <section className="card">
              <QuickForm
                title="Médico"
                path="doctors"
                fields={[{ key: "full_name", label: "Nombre completo" }, { key: "specialty", label: "Especialidad" }]}
                onCreated={loadLists}
              />
            </section>
            <section className="card" aria-labelledby="doc-list">
              <h2 id="doc-list">Listado</h2>
              <p className="sub">{doctors.length} médicos registrados.</p>
              <table>
                <thead><tr><th>Nombre</th><th>Especialidad</th></tr></thead>
                <tbody>{doctors.map((d) => <tr key={d.id}><td>{d.full_name}</td><td>{d.specialty}</td></tr>)}</tbody>
              </table>
            </section>
          </main>
        )}

        {view === "pacientes" && (
          <main className="layout">
            <section className="card stack">
              <QuickForm
                title="Paciente"
                path="patients"
                fields={[{ key: "full_name", label: "Nombre completo" }, { key: "document_id", label: "Documento" }, { key: "phone", label: "Teléfono", optional: true }]}
                onCreated={loadLists}
              />
              <hr />
              <EditPatient patients={patients} onSaved={loadLists} />
            </section>
            <section className="card" aria-labelledby="pat-list">
              <h2 id="pat-list">Listado</h2>
              <p className="sub">{patients.length} pacientes registrados.</p>
              <table>
                <thead><tr><th>Nombre</th><th>Documento</th><th>Teléfono</th></tr></thead>
                <tbody>{patients.map((p) => <tr key={p.id}><td>{p.full_name}</td><td>{p.document_id}</td><td>{p.phone ?? "—"}</td></tr>)}</tbody>
              </table>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

type Field = { key: string; label: string; optional?: boolean };

function QuickForm({ title, path, fields, onCreated }: { title: string; path: string; fields: Field[]; onCreated: () => void }) {
  const empty = Object.fromEntries(fields.map((f) => [f.key, ""]));
  const [values, setValues] = useState<Record<string, string>>(empty);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();
    setMsg(res.ok ? { ok: true, text: `${title} registrado: ${body.full_name}.` } : { ok: false, text: body.error });
    if (res.ok) { setValues(empty); onCreated(); }
  }

  return (
    <form onSubmit={submit} aria-label={`Registrar ${title.toLowerCase()}`}>
      <h2 style={{ margin: 0 }}>Registrar {title.toLowerCase()}</h2>
      {fields.map((f) => (
        <label key={f.key}>{f.label}{f.optional ? " (opcional)" : ""}
          <input value={values[f.key]} required={!f.optional} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
        </label>
      ))}
      <button type="submit">Registrar {title.toLowerCase()}</button>
      {msg && <p role="alert" className={`alert ${msg.ok ? "ok" : "err"}`} style={{ margin: 0 }}>{msg.text}</p>}
    </form>
  );
}

function EditPatient({ patients, onSaved }: { patients: Item[]; onSaved: () => void }) {
  const [id, setId] = useState("");
  const [values, setValues] = useState({ full_name: "", document_id: "", phone: "", email: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(newId: string) {
    setId(newId);
    setMsg(null);
    const p = patients.find((x) => x.id === newId);
    setValues({ full_name: p?.full_name ?? "", document_id: p?.document_id ?? "", phone: p?.phone ?? "", email: p?.email ?? "" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(`${API}/patients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();
    setMsg(res.ok ? { ok: true, text: `Paciente actualizado: ${body.full_name}.` } : { ok: false, text: body.error });
    if (res.ok) onSaved();
  }

  const field = (key: keyof typeof values, label: string, required = true) => (
    <label>{label}{required ? "" : " (opcional)"}
      <input value={values[key]} required={required} disabled={!id} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
    </label>
  );

  return (
    <form onSubmit={submit} aria-label="Editar paciente">
      <h2 style={{ margin: 0 }}>Editar paciente</h2>
      <label>Paciente
        <select value={id} onChange={(e) => pick(e.target.value)} required>
          <option value="">Elige un paciente…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </label>
      {field("full_name", "Nombre completo")}
      {field("document_id", "Documento")}
      {field("phone", "Teléfono", false)}
      {field("email", "Correo", false)}
      <button type="submit" disabled={!id}>Guardar cambios</button>
      {msg && <p role="alert" className={`alert ${msg.ok ? "ok" : "err"}`} style={{ margin: 0 }}>{msg.text}</p>}
    </form>
  );
}
