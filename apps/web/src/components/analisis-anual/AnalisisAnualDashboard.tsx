"use client";

import "@/lib/chart/registerChartJs";

import type { ChartData } from "chart.js";
import { Bar, Chart } from "react-chartjs-2";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";

import {
  brechaAnnualChartOptions,
  buildBrechaAnnualStacked,
  buildCopaVsAnnualMixed,
  buildMonthlyAnnualData,
  copaVsAnnualOptions,
  monthlyAnnualOptions,
  type CopaVsAnnualShape,
  type MonthlyAnnualShape,
} from "@/lib/analisis-anual/annualCharts";
import { buildAnnualVm } from "@/lib/analisis-anual/annualVm";

type AnnualMeta = {
  annual_monitor: {
    meta: {
      default_period_id: string;
      available_periods: { id: string; label: string; year: number; incomplete?: boolean }[];
    };
    data: Record<
      string,
      {
        kpi: Parameters<typeof buildAnnualVm>[0];
        charts: {
          monthly: MonthlyAnnualShape;
          copa_vs_salario: CopaVsAnnualShape;
        };
      }
    >;
  };
};

function useMobile768() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setM(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return m;
}

export default function AnalisisAnualDashboard() {
  const [payload, setPayload] = useState<AnnualMeta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [yearId, setYearId] = useState("");
  const isMobile = useMobile768();

  useEffect(() => {
    let c = false;
    fetch("/data/_data_ipce_v1.json")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los datos.");
        return r.json() as Promise<AnnualMeta>;
      })
      .then((j) => {
        if (c) return;
        setPayload(j);
        const def = j.annual_monitor.meta.default_period_id;
        setYearId(def || "");
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Error"));
    return () => {
      c = true;
    };
  }, []);

  const mon = payload?.annual_monitor;
  const periods = mon?.meta.available_periods ?? [];

  const periodRow = mon && yearId ? mon.data[yearId] : undefined;
  const iterYear = yearId ? parseInt(yearId, 10) : NaN;
  const prevYear = Number.isFinite(iterYear) ? iterYear - 1 : 0;

  const vm = useMemo(() => {
    if (!periodRow) return null;
    return buildAnnualVm(periodRow.kpi, iterYear);
  }, [periodRow, iterYear]);

  const monthlyData = useMemo(() => {
    if (!periodRow || !Number.isFinite(iterYear)) return null;
    return buildMonthlyAnnualData(periodRow.charts.monthly, iterYear, prevYear, isMobile);
  }, [periodRow, iterYear, prevYear, isMobile]);

  const monthlyOpts = useMemo(() => monthlyAnnualOptions(), []);

  const copaVsMixed = useMemo(() => {
    if (!periodRow) return null;
    return buildCopaVsAnnualMixed(periodRow.charts.copa_vs_salario, isMobile);
  }, [periodRow, isMobile]);

  const copaVsOpts = useMemo(() => copaVsAnnualOptions(), []);

  const brechaBundle = useMemo(() => {
    if (!periodRow || !Number.isFinite(iterYear)) return null;
    const k = periodRow.kpi;
    return buildBrechaAnnualStacked(
      periodRow.charts.copa_vs_salario,
      iterYear,
      k.meta?.max_month,
      k.meta?.is_complete,
      isMobile,
    );
  }, [periodRow, iterYear, isMobile]);

  const brechaOpts = useMemo(() => brechaAnnualChartOptions(), []);

  const onYear = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      const idx = periods.findIndex((p) => p.id === v);
      const incomplete = periods[idx]?.incomplete;
      if (incomplete) {
        alert(
          "Atención: El año seleccionado aún cuenta con datos incompletos. Las comparativas se realizan contra los mismos meses del año anterior.",
        );
      }
      setYearId(v);
    },
    [periods],
  );

  if (err) {
    return (
      <div className="chart-container">
        <p style={{ color: "var(--accent-danger)" }}>{err}</p>
      </div>
    );
  }

  if (!payload || !mon || !yearId || !periodRow || !vm || !Number.isFinite(iterYear)) {
    return (
      <div className="chart-container">
        <p style={{ color: "var(--text-secondary)" }}>Cargando…</p>
      </div>
    );
  }

  const grid: CSSProperties | undefined = undefined;

  const showBrechaBlock = brechaBundle !== null;

  return (
    <>
      <div
        className="header-content"
        style={{
          textAlign: "left",
          marginBottom: "3rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <h1 className="text-gradient dashboard-title" style={{ marginBottom: 0, fontSize: "1.5rem" }}>
          Recursos de Origen Nacional (RON)
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="year-selector-aa" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
            Período:
          </label>
          <select
            id="year-selector-aa"
            className="period-select"
            value={yearId}
            onChange={onYear}
            aria-label="Seleccionar año"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 6,
              border: "1px solid var(--border-color)",
              background: "var(--card-bg)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-family)",
              fontSize: "1rem",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {periods
              .filter((p) => p.id !== "2022" && p.year !== 2022)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.incomplete ? p.label.replace(" (YTD)", "") + " (incompleto)" : p.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      <section className="hero-grid" style={grid}>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="RON disponible año seleccionado y desglose neta/bruta.">
            ?
          </div>
          <div className="kpi-label">{`RON Disponible ${vm.periodLabel}`}</div>
          <div className="kpi-value">{vm.recaudacion.current}</div>
          <div
            className="kpi-sub"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontSize: "0.85rem",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              RON Neta: <strong>{vm.recaudacion.netaCurr}</strong>
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              RON Bruta: <strong>{vm.recaudacion.brutaCurr}</strong>
            </span>
          </div>
        </article>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="RON disponible año anterior (misma ventana si YTD).">?</div>
          <div className="kpi-label">{`RON Disponible Año ${prevYear}`}</div>
          <div className="kpi-value" style={{ color: "var(--text-secondary)" }}>
            {vm.recaudacion.prev}
          </div>
          <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <span>
              RON Neta: <strong>{vm.recaudacion.netaPrev}</strong>
            </span>
            <span>
              RON Bruta: <strong>{vm.recaudacion.brutaPrev}</strong>
            </span>
          </div>
        </article>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Variación nominal interanual RON disponible.">?</div>
          <div className="kpi-label">Variación Nominal RON</div>
          <div className={vm.recaudacion.varNomClass}>{vm.recaudacion.varNomPct}</div>
          <div className="kpi-sub">
            <span style={{ fontWeight: 700 }}>{vm.recaudacion.varNomAbs}</span>
            <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>Interanual</span>
          </div>
        </article>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Variación real interanual (IPC nacional).">?</div>
          <div className="kpi-label">Variación Real RON</div>
          <div className={vm.recaudacion.realPctClass}>{vm.recaudacion.realPct}</div>
          <div className="kpi-sub">
            <span style={{ fontWeight: 700 }} className={vm.recaudacion.realAbsClass}>
              {vm.recaudacion.realAbs}
            </span>
            <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>* Ajustado por inflación</span>
          </div>
        </article>
      </section>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.8rem",
          paddingLeft: 10,
          marginTop: "-3rem",
          marginBottom: "4rem",
        }}
      >
        Fuente: INDEC y Ministerio de Economía de la Nación
      </p>

      {vm.rop && (
        <div id="container-reca-prov">
          <div style={{ marginBottom: "3rem", marginTop: "4rem" }}>
            <h2 style={{ fontSize: "1.5rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Recaudación de Origen Provincial (ROP)
            </h2>
          </div>
          <section className="hero-grid">
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="ROP año actual.">?</div>
              <div className="kpi-label">{`ROP Disponible ${vm.periodLabel}`}</div>
              <div className="kpi-value">{vm.rop.dispCurr}</div>
              <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                ROP Total: <strong>{vm.rop.brutaCurr}</strong>
              </div>
            </article>
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="ROP año anterior.">?</div>
              <div className="kpi-label">{`ROP Disponible Año ${prevYear}`}</div>
              <div className="kpi-value" style={{ color: "var(--text-secondary)" }}>
                {vm.rop.dispPrev}
              </div>
              <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                ROP Total: <strong>{vm.rop.brutaPrev}</strong>
              </div>
            </article>
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="Variación nominal ROP.">?</div>
              <div className="kpi-label">Variación Nominal Recaudación Prov.</div>
              <div className={vm.rop.varNomClass}>{vm.rop.varNomPct}</div>
              <div className="kpi-sub">
                <span style={{ fontWeight: 700 }}>{vm.rop.varNomAbs}</span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>Interanual</span>
              </div>
            </article>
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="Variación real ROP (IPC NEA).">?</div>
              <div className="kpi-label">Variación Real Recaudación Prov.</div>
              <div className={vm.rop.realPctClass}>{vm.rop.realPct}</div>
              <div className="kpi-sub">
                <span style={{ fontWeight: 700 }} className={vm.rop.realAbsClass}>
                  {vm.rop.realAbs}
                </span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>* Ajustado por inflación</span>
              </div>
            </article>
          </section>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              paddingLeft: 10,
              marginTop: "-3rem",
              marginBottom: "4rem",
            }}
          >
            Fuente: Ministerio de Economía de la Provincia
          </p>
        </div>
      )}

      <div style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "1.5rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
          Distribución Municipal
        </h2>
      </div>

      {vm.muni && (
        <>
          <section className="hero-grid">
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="Distribución municipal período actual.">?</div>
              <div className="kpi-label">{`Distrib. Municipal ${vm.periodLabel}`}</div>
              <div className="kpi-value">{vm.muni.current}</div>
              <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <span>
                  Orig. Nac.: {vm.muni.natCurr}
                  <br />
                  Orig. Prov.: {vm.muni.provCurr}
                </span>
              </div>
            </article>
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="Distribución municipal año anterior.">?</div>
              <div className="kpi-label">{`Distrib. Municipal Año ${prevYear}`}</div>
              <div className="kpi-value" style={{ color: "var(--text-secondary)" }}>
                {vm.muni.prev}
              </div>
              <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <span>
                  Orig. Nac.: {vm.muni.natPrev}
                  <br />
                  Orig. Prov.: {vm.muni.provPrev}
                </span>
              </div>
            </article>
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="Variación nominal distribución municipal.">?</div>
              <div className="kpi-label">Variación Nominal Distrib. Municipal</div>
              <div className={vm.muni.varNomClass}>{vm.muni.varNomPct}</div>
              <div className="kpi-sub">
                <span style={{ fontWeight: 700 }}>{vm.muni.varNomAbs}</span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>Interanual</span>
              </div>
            </article>
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="Variación real distribución municipal.">?</div>
              <div className="kpi-label">Variación Real Distrib. Municipal</div>
              <div className={vm.muni.realPctClass}>{vm.muni.realPct}</div>
              <div className="kpi-sub">
                <span style={{ fontWeight: 700 }} className={vm.muni.realAbsClass}>
                  {vm.muni.realAbs}
                </span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>* Ajustado por inflación</span>
              </div>
            </article>
          </section>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              paddingLeft: 10,
              marginTop: "-3rem",
              marginBottom: "4rem",
            }}
          >
            Fuente: INDEC y Ministerio de Economía de la Nación
          </p>
        </>
      )}

      <div className="header-content" style={{ textAlign: "left", marginTop: "4rem", marginBottom: "2rem" }}>
        <h2 className="text-gradient dashboard-title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
          Masa Salarial Total Empleo Provincial
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
          Relación entre Coparticipación y Masa Salarial
        </p>
      </div>

      <section className="hero-grid">
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Masa salarial año seleccionado.">?</div>
          <div className="kpi-label">{`Masa Salarial ${vm.periodLabel}`}</div>
          <div className="kpi-value">{vm.masa.current}</div>
          <div className="kpi-sub">
            <span style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{vm.masa.cobCurr}</span>
          </div>
        </article>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Masa salarial año anterior.">?</div>
          <div className="kpi-label">{`Masa Salarial Año ${prevYear}`}</div>
          <div className="kpi-value" style={{ color: "var(--text-secondary)" }}>
            {vm.masa.prev}
          </div>
          <div className="kpi-sub" style={{ color: "var(--text-secondary)" }}>
            {vm.masa.cobPrev}
          </div>
        </article>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Variación nominal masa salarial.">?</div>
          <div className="kpi-label">Variación Nominal Masa Salarial</div>
          <div className={vm.masa.varNomPctClass}>{vm.masa.varNomPct}</div>
          <div className="kpi-sub">
            <span style={{ fontWeight: 700 }}>{vm.masa.varNomAbs}</span>
            <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>Interanual</span>
          </div>
        </article>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Variación real masa salarial.">?</div>
          <div className="kpi-label">Variación Real Masa Salarial</div>
          <div className={vm.masa.realPctClass}>{vm.masa.realPct}</div>
          <div className="kpi-sub">
            <span style={{ fontWeight: 700 }} className={vm.masa.realAbsClass}>
              {vm.masa.realAbs}
            </span>
            <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>* Ajustado por inflación</span>
          </div>
        </article>
      </section>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.8rem",
          paddingLeft: 10,
          marginTop: "-3rem",
          marginBottom: "4rem",
        }}
      >
        Fuente: Contaduría General de la Provincia de Corrientes
      </p>

      <section className="chart-container annual-chart-card">
        <div className="info-tooltip" data-tooltip="RON acumulado mensual vs objetivo salarial.">?</div>
        <div className="section-header">
          <div>
            <h2 className="section-title">RON Disponible vs Sueldos</h2>
            <p className="section-subtitle">Evolución acumulada mensual</p>
          </div>
        </div>
        <div className="chart-wrapper">
          {copaVsMixed && (
            <Chart type="bar" data={copaVsMixed as ChartData<"bar">} options={copaVsOpts} />
          )}
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "1rem" }}>
          Fuente: Ministerio de Economía de la Provincia (RON) / Contaduría General de la Provincia de Corrientes
          (Salarios)
        </p>
      </section>

      <section className="chart-container annual-chart-card" style={{ marginTop: "4rem", marginBottom: "4rem" }}>
        <div className="info-tooltip" data-tooltip="Ingresos mensuales nominales — comparación interanual.">?</div>
        <div className="section-header">
          <div>
            <h2 className="section-title">{`Comportamiento de RON Disponible Mensual ${iterYear}`}</h2>
            <p className="section-subtitle">Comparativa de ingresos mensuales nominales (Billones de pesos)</p>
          </div>
        </div>
        <div className="chart-wrapper">{monthlyData && <Bar data={monthlyData} options={monthlyOpts} />}</div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "1rem" }}>
          Fuente: INDEC y Ministerio de Economía de la Nación
        </p>
      </section>

      {showBrechaBlock && brechaBundle && (
        <div id="presupuesto-section-anual">
          <div className="header-content" style={{ textAlign: "left", marginTop: "2rem", marginBottom: "2rem" }}>
            <h2 className="text-gradient dashboard-title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              Desempeño Frente a Presupuesto Anual
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)" }}>
              Análisis comparativo de la RON neta efectiva acumulada frente a los fondos presupuestados acumulados del
              año.
            </p>
          </div>

          <section
            className="hero-grid budget-grid"
            style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: "2rem" }}
          >
            <article className="kpi-card" style={{ height: "auto" }}>
              <div className="info-tooltip" data-tooltip="Brecha nominal acumulada RON vs presupuesto.">?</div>
              <div className="kpi-label">RON: DIFERENCIA NOMINAL</div>
              <div className={brechaBundle.card.diffAbsClass}>{brechaBundle.card.diffAbs}</div>
              <div className="kpi-sub" style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>
                  Recaudado: <strong style={{ color: "#0f172a" }}>{brechaBundle.card.recaudado}</strong>
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  Presupuestado: <strong style={{ color: "#0f172a" }}>{brechaBundle.card.esperada}</strong>
                </span>
              </div>
            </article>
            <article className="kpi-card" style={{ height: "auto" }}>
              <div className="info-tooltip" data-tooltip="Brecha porcentual acumulada.">?</div>
              <div className="kpi-label">RON: DIFERENCIA PORCENTUAL</div>
              <div className={brechaBundle.card.diffPctClass}>{brechaBundle.card.diffPct}</div>
              <div className="kpi-sub">
                <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>
                  Brecha Porcentual respecto al monto presupuestado acumulado
                </span>
              </div>
            </article>
            {vm.presupuestoProv && (
              <>
                <article className="kpi-card" style={{ height: "auto" }}>
                  <div className="info-tooltip" data-tooltip="Brecha provincial nominal.">?</div>
                  <div className="kpi-label">RECAUDACION PROVINCIAL: DIFERENCIA NOMINAL</div>
                  <div className={vm.presupuestoProv.diffAbsClass}>{vm.presupuestoProv.diffAbs}</div>
                  <div className="kpi-sub" style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>
                      Recaudado: <strong style={{ color: "#0f172a" }}>{vm.presupuestoProv.recaudado}</strong>
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      Presupuestado: <strong style={{ color: "#0f172a" }}>{vm.presupuestoProv.esperada}</strong>
                    </span>
                  </div>
                </article>
                <article className="kpi-card" style={{ height: "auto" }}>
                  <div className="info-tooltip" data-tooltip="Brecha provincial porcentual.">?</div>
                  <div className="kpi-label">RECAUDACION PROVINCIAL: DIFERENCIA PORCENTUAL</div>
                  <div className={vm.presupuestoProv.diffPctClass}>{vm.presupuestoProv.diffPct}</div>
                  <div className="kpi-sub">
                    <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>
                      Brecha Porcentual respecto al monto presupuestado acumulado provincial
                    </span>
                  </div>
                </article>
              </>
            )}
          </section>
        </div>
      )}

      {showBrechaBlock && brechaBundle && (
        <section className="chart-container annual-chart-brecha" style={{ marginTop: "4rem", marginBottom: "4rem" }}>
          <div className="info-tooltip" data-tooltip="Brecha acumulada efectiva vs esperada — año 2026.">?</div>
          <div className="section-header">
            <div>
              <h2 className="section-title">Brecha Recaudación Acumulada Anual</h2>
              <p className="section-subtitle">Efectiva vs Esperada</p>
            </div>
          </div>
          <div className="chart-wrapper">
            <Bar data={brechaBundle.chartData} options={brechaOpts} />
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "1rem" }}>
            Fuente: Ministerio de Economía de la Provincia
          </p>
        </section>
      )}
    </>
  );
}
