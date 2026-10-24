import { useEffect, useState, type FormEvent } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type Item = { id: string; full_name: string };
type Appt = { id: string; starts_at: string; ends_at: string; patient_id: string };

export default function App() {
  const [doctors, setDoctors] = useState<Item[]>([]);
  const [patients, setPatients] = useState<Item[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [agenda, setAgenda] = useState<Appt[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/doctors`).then((r) => r.json()).then((d) => { setDoctors(d); setDoctorId(d[0]?.id ?? ""); });
    fetch(`${API}/patients`).then((r) => r.json()).then((p) => { setPatients(p); setPatientId(p[0]?.id ?? ""); });
  }, []);

  const loadAgenda = () => {
    if (doctorId) fetch(`${API}/doctors/${doctorId}/appointments?date=${date}`).then((r) => r.json()).then(setAgenda);
  };
  useEffect(loadAgenda, [doctorId, date]);

  async function submit(e: FormEvent) {
    e.preventDefault();
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
    setMsg(res.ok ? { ok: true, text: "Cita agendada." } : { ok: false, text: body.error });
    if (res.ok) loadAgenda();
  }

  const time = (s: string) => new Date(s).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const name = (id: string) => patients.find((p) => p.id === id)?.full_name ?? id;

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 520, margin: "2rem auto", padding: "0 1rem", fontSize: 18 }}>
      <h1>Agenda médica</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <label>Médico
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} style={{ width: "100%", fontSize: 18 }}>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </label>
        <label>Paciente
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ width: "100%", fontSize: 18 }}>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
        <label>Fecha <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label>Inicio <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
        <label>Fin <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>
        <button type="submit" style={{ fontSize: 20, padding: "12px" }}>Agendar cita</button>
      </form>
      {msg && (
        <p role="alert" style={{ padding: 12, background: msg.ok ? "#d1fae5" : "#fee2e2", color: msg.ok ? "#065f46" : "#991b1b" }}>
          {msg.text}
        </p>
      )}
      <h2>Agenda del día</h2>
      {agenda.length === 0 ? <p>Sin citas.</p> : (
        <ul>{agenda.map((a) => <li key={a.id}>{time(a.starts_at)}–{time(a.ends_at)} · {name(a.patient_id)}</li>)}</ul>
      )}
    </main>
  );
}
