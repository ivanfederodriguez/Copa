"use client";

import "@/lib/chart/registerChartJs";

import type { ChartData } from "chart.js";
import { Bar, Chart } from "react-chartjs-2";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";

import {
  barComparisonOptions,
  buildBarComparison,
  buildBrechaStacked,
  buildCopaVsSalarioMixed,
  buildDailyBarData,
  buildRealEvolutionSeries,
  brechaOptions,
  copaVsSalarioOptions,
  dailyBarOptions,
} from "@/lib/monitor-mensual/chartData";
import {
  buildMonitorViewModel,
  type MonitorJson,
} from "@/lib/monitor-mensual/viewModel";

function useViewportFlags() {
  const [wide768, setWide768] = useState(false);
  const [wide640, setWide640] = useState(false);

  useEffect(() => {
    const mq768 = window.matchMedia("(max-width: 768px)");
    const mq640 = window.matchMedia("(max-width: 640px)");
    const sync = () => {
      setWide768(mq768.matches);
      setWide640(mq640.matches);
    };
    sync();
    mq768.addEventListener("change", sync);
    mq640.addEventListener("change", sync);
    return () => {
      mq768.removeEventListener("change", sync);
      mq640.removeEventListener("change", sync);
    };
  }, []);

  return { isMobile768: wide768, isMobile640: wide640 };
}

export default function MonitorMensualDashboard() {
  const [data, setData] = useState<MonitorJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string>("");
  const { isMobile768, isMobile640 } = useViewportFlags();

  useEffect(() => {
    let cancelled = false;
    fetch("/data/_data_ipce_v1.json")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los datos.");
        return r.json() as Promise<MonitorJson>;
      })
      .then((j) => {
        if (cancelled) return;
        setData(j);
        const def = j.meta.default_period_id;
        setPeriodId(def || j.meta.available_periods[j.meta.available_periods.length - 1]?.id || "");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar datos.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const periodMeta = data?.meta.available_periods ?? [];
  const defaultIndex = periodMeta.findIndex((p) => p.id === data?.meta.default_period_id);

  const chosen = data && periodId ? data.data[periodId] : undefined;
  const vm = useMemo(() => {
    if (!data || !chosen) return null;
    return buildMonitorViewModel(data, periodId, chosen.kpi, isMobile640);
  }, [data, periodId, chosen, isMobile640]);

  const charts = chosen?.charts;

  const dailyData = useMemo(() => {
    if (!charts || !vm) return null;
    return buildDailyBarData(charts.daily, vm.monthName, vm.currentYear, vm.prevYear, isMobile768);
  }, [charts, vm, isMobile768]);

  const dailyOpts = useMemo(() => {
    if (!vm) return null;
    return dailyBarOptions(vm.monthName);
  }, [vm]);

  const copaVsData = useMemo(() => {
    if (!charts) return null;
    return buildCopaVsSalarioMixed(charts.copa_vs_salario, isMobile768);
  }, [charts, isMobile768]);

  const copaVsOpts = useMemo(() => copaVsSalarioOptions(), []);

  const copaVsTitle = charts?.copa_vs_salario?.copa_label && charts?.copa_vs_salario?.salario_label
    ? `Recursos Disponibles ${charts.copa_vs_salario.copa_label} vs Sueldos ${charts.copa_vs_salario.salario_label}`
    : "Recursos Disponibles vs Sueldos";

  const brechaData = useMemo(() => {
    if (!charts) return null;
    return buildBrechaStacked(charts.copa_vs_salario);
  }, [charts]);

  const brechaOpts = useMemo(() => {
    if (!charts) return null;
    const dataCopa = charts.copa_vs_salario;
    const neta = dataCopa.cumulative_neta;
    const useNeta = neta?.some((v) => v != null);
    const actualDataRaw = useNeta ? neta! : dataCopa.cumulative_copa;
    const expectedData = dataCopa.cumulative_esperada ?? [];
    return brechaOptions(expectedData, actualDataRaw ?? []);
  }, [charts]);

  const realEvol = useMemo(() => {
    if (!data || !periodId) return null;
    return buildRealEvolutionSeries(data, periodId);
  }, [data, periodId]);

  const chartCopaReal = useMemo(() => {
    if (!realEvol) return null;
    return buildBarComparison(
      realEvol.labels,
      "RON Disponible Real",
      realEvol.copaCurrent,
      realEvol.copaPrevReal,
      "#10b981",
      realEvol.barPeriods,
    );
  }, [realEvol]);

  const chartMasaReal = useMemo(() => {
    if (!realEvol) return null;
    return buildBarComparison(
      realEvol.labels,
      "Masa Salarial Real",
      realEvol.masaCurrent,
      realEvol.masaPrevReal,
      "#3b82f6",
      realEvol.barPeriods,
    );
  }, [realEvol]);

  const optCopaReal = useMemo(() => {
    if (!realEvol) return null;
    return barComparisonOptions("RON Disponible Real", realEvol.barPeriods);
  }, [realEvol]);

  const optMasaReal = useMemo(() => {
    if (!realEvol) return null;
    return barComparisonOptions("Masa Salarial Real", realEvol.barPeriods);
  }, [realEvol]);

  const onPeriodChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value;
      const idx = periodMeta.findIndex((p) => p.id === next);
      const incomplete = defaultIndex >= 0 && idx > defaultIndex;
      if (incomplete) {
        alert(
          "Atención: El periodo seleccionado aún cuenta con datos incompletos. Las variaciones y proyecciones pueden cambiar significativamente hasta el cierre definitivo.",
        );
      }
      setPeriodId(next);
    },
    [periodMeta, defaultIndex],
  );

  if (error) {
    return (
      <div className="chart-container">
        <p style={{ color: "var(--accent-danger)" }}>{error}</p>
      </div>
    );
  }

  if (!data || !periodId || !vm || !chosen) {
    return (
      <div className="chart-container">
        <p style={{ color: "var(--text-secondary)" }}>Cargando datos…</p>
      </div>
    );
  }

  const reversedPeriods = [...periodMeta].reverse();

  const gridResumen: CSSProperties = { gridTemplateColumns: "repeat(2, 1fr)" };

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
          Recursos Disponibles Totales
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="month-selector-monitor" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
            Período:
          </label>
          <select
            id="month-selector-monitor"
            className="period-select"
            value={periodId}
            onChange={onPeriodChange}
            aria-label="Seleccionar periodo"
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
            {reversedPeriods.map((p) => {
              const pIndex = periodMeta.findIndex((x) => x.id === p.id);
              const incomplete = defaultIndex >= 0 && pIndex > defaultIndex;
              return (
                <option key={p.id} value={p.id} data-incomplete={incomplete ? "true" : undefined}>
                  {p.label} {p.year}
                  {incomplete ? " (Incompleto)" : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "-1rem", marginBottom: "2rem" }}>
        {vm.mainSubtitle}
      </p>

      <section className="hero-grid" id="row-resumen-cards" style={gridResumen}>
        <article className="kpi-card" style={{ border: "1px solid var(--accent-primary)" }}>
          <div
            className="info-tooltip"
            data-tooltip="Suma de RON Disponible + ROP Disponible. Representa el total de recursos líquidos de libre disponibilidad para el periodo."
          >
            ?
          </div>
          <div className="kpi-label">Recaudación Total Disponible</div>
          <div className="kpi-value">{vm.resumen.totalDisp}</div>
          <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            RON: <strong>{vm.resumen.ronDisp}</strong> | ROP: <strong>{vm.resumen.ropDisp}</strong>
          </div>
        </article>
        <article className="kpi-card" style={{ border: "1px solid var(--accent-primary)" }}>
          <div
            className="info-tooltip"
            data-tooltip="Monto remanente tras descontar la Masa Salarial del total de recursos disponibles (Recaudación Total Disponible - Masa Salarial)."
          >
            ?
          </div>
          <div className="kpi-label">RECURSOS PARA GASTOS OPERATIVOS E INVERSIÓN</div>
          <div className={`kpi-value ${vm.resumen.postClass}`.trim()}>{vm.resumen.postSueldos}</div>
          <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Monto remanente tras cubrir salarios
          </div>
        </article>
      </section>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.8rem",
          textAlign: "left",
          paddingLeft: 10,
          marginTop: "-3rem",
          marginBottom: "4rem",
        }}
      >
        Fuente: INDEC y Ministerio de Economía de la Nación
      </p>

      <div style={{ marginTop: "3rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
        <h2 style={{ fontSize: "1.5rem", color: "var(--text-primary)" }}>Recursos de Origen Nacional (RON)</h2>
      </div>

      <section className="hero-grid" id="row-copa-cards" style={{ gridTemplateColumns: vm.grid.copaCols }}>
        <article className="kpi-card">
          <div
            className="info-tooltip"
            data-tooltip={`Monto total, en pesos corrientes, de los ingresos provinciales disponibles provenientes de los Recursos de Origen Nacional (RON) para el periodo actual seleccionado.`}
          >
            ?
          </div>
          <div className="kpi-label">{`RON Disponible ${vm.monthName} ${vm.currentYear}${vm.labelSuffix}`}</div>
          <div className="kpi-value">{vm.recaudacion.current}</div>
          <div
            className="kpi-sub"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              textAlign: "left",
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
          <div className="info-tooltip" data-tooltip="Comparación interanual del RON disponible (mismo mes año anterior).">
            ?
          </div>
          <div className="kpi-label">{`RON Disponible ${vm.monthName} ${vm.prevYear}`}</div>
          <div className="kpi-value" style={{ color: "var(--text-secondary)" }}>
            {vm.recaudacion.prev}
          </div>
          <div
            className="kpi-sub"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 4,
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
            }}
          >
            <span>
              RON Neta: <strong>{vm.recaudacion.netaPrev}</strong>
            </span>
            <span>
              RON Bruta: <strong>{vm.recaudacion.brutaPrev}</strong>
            </span>
          </div>
        </article>

        {vm.showVarCards.copaNom && (
          <article className="kpi-card" id="card-copa-var-nom">
            <div className="info-tooltip" data-tooltip="Variación nominal interanual del RON disponible.">
              ?
            </div>
            <div className="kpi-label">Variación Nominal RON</div>
            <div className={vm.recaudacion.varNomClass}>{vm.recaudacion.varNomPct}</div>
            <div className="kpi-sub">
              <span style={{ fontWeight: 700 }}>{vm.recaudacion.varNomAbs}</span>
              <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>Interanual</span>
            </div>
          </article>
        )}

        {vm.showVarCards.copaReal && (
          <article className="kpi-card" id="card-copa-var-real">
            <div className="info-tooltip" data-tooltip="Variación real interanual del RON disponible (IPC país).">
              ?
            </div>
            <div className="kpi-label">Variación Real RON</div>
            <div className={vm.recaudacion.realPctClass}>{vm.recaudacion.realPct}</div>
            <div className="kpi-sub">
              <span style={{ fontWeight: 700 }} className={vm.recaudacion.realAbsClass}>
                {vm.recaudacion.realAbs}
              </span>
              <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>* Ajustado por inflación</span>
            </div>
          </article>
        )}
      </section>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.8rem",
          textAlign: "left",
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
          <section className="hero-grid" id="row-reca-prov-cards" style={{ gridTemplateColumns: vm.grid.recaProvCols }}>
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="Recaudación provincial disponible (periodo actual).">
                ?
              </div>
              <div className="kpi-label">{`ROP Disponible ${vm.monthName} ${vm.currentYear}${vm.labelSuffix}`}</div>
              <div className="kpi-value">{vm.rop.dispCurr}</div>
              <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                ROP Bruta: <strong>{vm.rop.brutaCurr}</strong>
              </div>
            </article>
            <article className="kpi-card">
              <div className="info-tooltip" data-tooltip="Recaudación provincial disponible (mismo mes año anterior).">
                ?
              </div>
              <div className="kpi-label">{`ROP Disponible ${vm.monthName} ${vm.prevYear}`}</div>
              <div className="kpi-value" style={{ color: "var(--text-secondary)" }}>
                {vm.rop.dispPrev}
              </div>
              <div className="kpi-sub" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                ROP Bruta: <strong>{vm.rop.brutaPrev}</strong>
              </div>
            </article>
            {vm.showVarCards.recaProvNom && (
              <article className="kpi-card" id="card-reca-prov-var-nom">
                <div className="info-tooltip" data-tooltip="Variación nominal interanual de la recaudación provincial disponible.">
                  ?
                </div>
                <div className="kpi-label">Variación Nominal Recaudación Prov.</div>
                <div className={vm.rop.varNomClass}>{vm.rop.varNomPct}</div>
                <div className="kpi-sub">
                  <span style={{ fontWeight: 700 }}>{vm.rop.varNomAbs}</span>
                  <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>Interanual</span>
                </div>
              </article>
            )}
            {vm.showVarCards.recaProvReal && (
              <article className="kpi-card" id="card-reca-prov-var-real">
                <div className="info-tooltip" data-tooltip="Variación real interanual (IPC NEA).">
                  ?
                </div>
                <div className="kpi-label">Variación Real Recaudación Prov.</div>
                <div className={vm.rop.realPctClass}>{vm.rop.realPct}</div>
                <div className="kpi-sub">
                  <span style={{ fontWeight: 700 }} className={vm.rop.realAbsClass}>
                    {vm.rop.realAbs}
                  </span>
                  <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>* Ajustado por inflación</span>
                </div>
              </article>
            )}
          </section>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              textAlign: "left",
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
        <section className="hero-grid" id="row-muni-cards" style={{ gridTemplateColumns: vm.grid.muniCols }}>
          <article className="kpi-card">
            <div className="info-tooltip" data-tooltip="Distribución municipal — periodo actual.">
              ?
            </div>
            <div className="kpi-label">{`Distrib. Municipal ${vm.monthName} ${vm.currentYear}${vm.labelSuffix}`}</div>
            <div className="kpi-value">{vm.muni.current}</div>
            <div
              className="kpi-sub"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                textAlign: "left",
                gap: 4,
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
              }}
            >
              <span>
                Orig. Nac.: {vm.muni.breakdownCurrNat}
                <br />
                Orig. Prov.: {vm.muni.breakdownCurrProv}
              </span>
            </div>
          </article>
          <article className="kpi-card">
            <div className="info-tooltip" data-tooltip="Distribución municipal — mismo mes año anterior.">
              ?
            </div>
            <div className="kpi-label">{`Distrib. Municipal ${vm.monthName} ${vm.prevYear}`}</div>
            <div className="kpi-value" style={{ color: "var(--text-secondary)" }}>
              {vm.muni.prev}
            </div>
            <div
              className="kpi-sub"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 4,
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
              }}
            >
              <span>
                Orig. Nac.: {vm.muni.breakdownPrevNat}
                <br />
                Orig. Prov.: {vm.muni.breakdownPrevProv}
              </span>
            </div>
          </article>
          {vm.showVarCards.muniNom && (
            <article className="kpi-card" id="card-muni-var-nom">
              <div className="info-tooltip" data-tooltip="Variación nominal interanual de la distribución municipal.">
                ?
              </div>
              <div className="kpi-label">Variación Nominal Distrib. Municipal</div>
              <div className={vm.muni.varNomClass}>{vm.muni.varNomPct}</div>
              <div className="kpi-sub">
                <span style={{ fontWeight: 700 }}>{vm.muni.varNomAbs}</span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>Interanual</span>
              </div>
            </article>
          )}
          {vm.showVarCards.muniReal && (
            <article className="kpi-card" id="card-muni-var-real">
              <div className="info-tooltip" data-tooltip="Variación real interanual (IPC NEA).">
                ?
              </div>
              <div className="kpi-label">Variación Real Distrib. Municipal</div>
              <div className={vm.muni.realPctClass}>{vm.muni.realPct}</div>
              <div className="kpi-sub">
                <span style={{ fontWeight: 700 }} className={vm.muni.realAbsClass}>
                  {vm.muni.realAbs}
                </span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>* Ajustado por inflación</span>
              </div>
            </article>
          )}
        </section>
      )}

      {vm.muni && (
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.8rem",
            textAlign: "left",
            paddingLeft: 10,
            marginTop: "-3rem",
            marginBottom: "4rem",
          }}
        >
          Fuente: INDEC y Ministerio de Economía de la Nación
        </p>
      )}

      {vm.showPresupuestoSection && vm.presupuesto && (
        <div id="presupuesto-section">
          <div className="header-content" style={{ textAlign: "left", marginTop: "2rem", marginBottom: "2rem" }}>
            <h2 className="text-gradient dashboard-title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              Desempeño Frente a Presupuesto
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)" }}>
              Análisis comparativo de la coparticipación neta efectiva frente a los fondos presupuestados para el mes
              seleccionado.
            </p>
          </div>
          <section
            className="hero-grid budget-grid"
            style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: "1rem" }}
          >
            <article className="kpi-card" style={{ height: "auto" }}>
              <div className="info-tooltip" data-tooltip="Diferencia nominal vs presupuesto (RON bruto).">
                ?
              </div>
              <div className="kpi-label">RON: DIFERENCIA NOMINAL</div>
              <div className={vm.presupuesto.diffAbsClass}>{vm.presupuesto.diffAbs}</div>
              <div className="kpi-sub" style={{ display: "flex", gap: 8, fontSize: "0.85rem", flexWrap: "wrap" }}>
                <span style={{ color: "var(--text-secondary)" }}>
                  Recaudado:{" "}
                  <strong style={{ color: "#0f172a" }}>{vm.presupuesto.recaudado}</strong>
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  Presupuestado:{" "}
                  <strong style={{ color: "#0f172a" }}>{vm.presupuesto.esperada}</strong>
                </span>
              </div>
            </article>
            <article className="kpi-card" style={{ height: "auto" }}>
              <div className="info-tooltip" data-tooltip="Brecha porcentual respecto al presupuesto mensual.">
                ?
              </div>
              <div className="kpi-label">RON: DIFERENCIA PORCENTUAL</div>
              <div className={vm.presupuesto.diffPctClass}>{vm.presupuesto.diffPct}</div>
              <div className="kpi-sub">
                <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>
                  Brecha Porcentual respecto al monto presupuestado
                </span>
              </div>
            </article>
            {vm.presupuesto.rop && (
              <>
                <article className="kpi-card" style={{ height: "auto" }}>
                  <div className="info-tooltip" data-tooltip="Diferencia nominal ROP vs presupuesto provincial.">
                    ?
                  </div>
                  <div className="kpi-label">RECAUDACION PROVINCIAL: DIFERENCIA NOMINAL</div>
                  <div className={vm.presupuesto.rop.diffAbsClass}>{vm.presupuesto.rop.diffAbs}</div>
                  <div className="kpi-sub" style={{ display: "flex", gap: 8, fontSize: "0.85rem", flexWrap: "wrap" }}>
                    <span style={{ color: "var(--text-secondary)" }}>
                      Recaudado:{" "}
                      <strong style={{ color: "#0f172a" }}>{vm.presupuesto.rop.recaudado}</strong>
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      Presupuestado:{" "}
                      <strong style={{ color: "#0f172a" }}>{vm.presupuesto.rop.esperada}</strong>
                    </span>
                  </div>
                </article>
                <article className="kpi-card" style={{ height: "auto" }}>
                  <div className="info-tooltip" data-tooltip="Brecha porcentual ROP.">
                    ?
                  </div>
                  <div className="kpi-label">RECAUDACION PROVINCIAL: DIFERENCIA PORCENTUAL</div>
                  <div className={vm.presupuesto.rop.diffPctClass}>{vm.presupuesto.rop.diffPct}</div>
                  <div className="kpi-sub">
                    <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>
                      Brecha Porcentual respecto al monto presupuestado provincial
                    </span>
                  </div>
                </article>
              </>
            )}
          </section>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.8rem",
              marginBottom: "4rem",
              textAlign: "left",
              paddingLeft: 10,
            }}
          >
            Fuente: Ministerio de Economía de la Provincia
          </p>
        </div>
      )}

      <div className="header-content" style={{ textAlign: "left", marginTop: "4rem", marginBottom: "2rem" }}>
        <h2 className="text-gradient dashboard-title" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
          Masa Salarial Total Empleo Provincial
        </h2>
        <p id="masa-salarial-subtitle" style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
          {`Relación entre RON y Masa Salarial para ${vm.monthName} ${vm.prevYear} vs ${vm.monthName} ${vm.currentYear}${vm.labelSuffix}`}
        </p>
      </div>

      <section className="hero-grid" id="row-masa-cards" style={{ gridTemplateColumns: vm.grid.masaCols }}>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Masa salarial liquidada en el periodo.">
            ?
          </div>
          <div className="kpi-label">{`Masa Salarial ${vm.monthName} ${vm.currentYear}${vm.labelSuffix}`}</div>
          <div className="kpi-value">{vm.masa.current}</div>
          <div className="kpi-sub">
            <span style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{vm.masa.cobCurr}</span>
          </div>
        </article>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Masa salarial mismo mes año anterior.">
            ?
          </div>
          <div className="kpi-label">{`Masa Salarial ${vm.monthName} ${vm.prevYear}`}</div>
          <div className="kpi-value" style={{ color: "var(--text-secondary)" }}>
            {vm.masa.prev}
          </div>
          <div className="kpi-sub" style={{ color: "var(--text-secondary)" }}>
            <span>{vm.masa.cobPrev}</span>
          </div>
        </article>
        <article className="kpi-card">
          <div className="info-tooltip" data-tooltip="Variación nominal interanual de la masa salarial.">
            ?
          </div>
          <div className="kpi-label">Variación Nominal Masa Salarial</div>
          <div className={vm.masa.varNomPctClass}>{vm.masa.varNomPct}</div>
          <div className="kpi-sub">
            <span style={{ fontWeight: 700 }}>{vm.masa.varNomAbs}</span>
            <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>Interanual</span>
          </div>
        </article>
        {vm.showVarCards.masaReal && (
          <article className="kpi-card" id="card-masa-var-real">
            <div className="info-tooltip" data-tooltip="Variación real interanual (IPC NEA).">
              ?
            </div>
            <div className="kpi-label">Variación Real Masa Salarial</div>
            <div className={vm.masa.realPctClass}>{vm.masa.realPct}</div>
            <div className="kpi-sub">
              <span style={{ fontWeight: 700 }} className={vm.masa.realAbsClass}>
                {vm.masa.realAbs}
              </span>
              <span style={{ color: "var(--text-secondary)", marginLeft: 5 }}>* Ajustado por inflación</span>
            </div>
          </article>
        )}
      </section>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.8rem",
          marginTop: "-3rem",
          marginBottom: "4rem",
          textAlign: "left",
          paddingLeft: 10,
        }}
      >
        Fuente: Contaduría General de la Provincia de Corrientes
      </p>

      <section className="chart-container">
        <div
          className="info-tooltip"
          data-tooltip="Comparación de la recaudación acumulada diaria de coparticipación disponible frente al monto objetivo para el pago de salarios."
        >
          ?
        </div>
        <div className="section-header">
          <div>
            <h2 className="section-title">{copaVsTitle}</h2>
            <p className="section-subtitle">¿Cuántos días de recaudación cubren la masa salarial?</p>
          </div>
        </div>
        <div className="chart-wrapper">
          {copaVsData && (
            <Chart
              type="bar"
              data={copaVsData as ChartData<"bar">}
              options={copaVsOpts}
            />
          )}
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "1rem", textAlign: "left" }}>
          Fuente: Ministerio de Economía de la Provincia (RON) / Contaduría General de la Provincia de Corrientes
          (Salarios)
        </p>
      </section>

      <section className="charts-grid-half" style={{ marginTop: "4rem" }}>
        <div className="chart-container" style={{ marginBottom: 0 }}>
          <div className="info-tooltip" data-tooltip="Evolución del RON disponible real — últimos 3 meses.">
            ?
          </div>
          <div className="section-header">
            <div>
              <h2 className="section-title">RON Disponible Real</h2>
              <p className="section-subtitle">Evolución últimos 3 meses (Pesos constantes)</p>
            </div>
          </div>
          <div className="chart-wrapper">
            {chartCopaReal && optCopaReal && <Bar data={chartCopaReal} options={optCopaReal} />}
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "1rem", textAlign: "left" }}>
            Fuente: Ministerio de Economía e INDEC (IPC NEA)
          </p>
        </div>
        <div className="chart-container" style={{ marginBottom: 0 }}>
          <div className="info-tooltip" data-tooltip="Evolución de la masa salarial real — últimos 3 meses.">
            ?
          </div>
          <div className="section-header">
            <div>
              <h2 className="section-title">Masa Salarial Real</h2>
              <p className="section-subtitle">Evolución últimos 3 meses (Pesos constantes)</p>
            </div>
          </div>
          <div className="chart-wrapper">
            {chartMasaReal && optMasaReal && <Bar data={chartMasaReal} options={optMasaReal} />}
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "1rem", textAlign: "left" }}>
            Fuente: Contaduría General de la Provincia de Corrientes e INDEC (IPC NEA)
          </p>
        </div>
      </section>

      <section className="chart-container" style={{ marginTop: "4rem", marginBottom: "4rem" }}>
        <div className="info-tooltip" data-tooltip="Ingresos diarios de coparticipación disponible — comparación interanual.">
          ?
        </div>
        <div className="section-header">
          <div>
            <h2 className="section-title">{`Comportamiento de RON Disponible Diario ${vm.monthName}`}</h2>
            <p className="section-subtitle">Comparativa de ingresos diarios nominales (Millones de pesos)</p>
          </div>
        </div>
        <div className="chart-wrapper">
          {dailyData && dailyOpts && <Bar data={dailyData} options={dailyOpts} />}
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "1rem", textAlign: "left" }}>
          Fuente: INDEC y Ministerio de Economía de la Nación
        </p>
      </section>

      <section className="chart-container" style={{ marginTop: "4rem", marginBottom: "4rem", display: "none" }}>
        <div className="info-tooltip" data-tooltip="Comparación acumulada efectiva vs esperada.">
          ?
        </div>
        <div className="section-header">
          <div>
            <h2 className="section-title">Brecha Recaudación Acumulada</h2>
            <p className="section-subtitle">Efectiva vs Esperada</p>
          </div>
        </div>
        <div className="chart-wrapper">{brechaData && brechaOpts && <Bar data={brechaData} options={brechaOpts} />}</div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "1rem", textAlign: "left" }}>
          Fuente: Ministerio de Economía de la Provincia
        </p>
      </section>
    </>
  );
}
