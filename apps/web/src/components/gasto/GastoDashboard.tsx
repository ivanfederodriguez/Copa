"use client";

import "@/lib/chart/registerChartJs";

import type { ChartData } from "chart.js";
import { Chart } from "react-chartjs-2";
import { useEffect, useMemo, useState } from "react";

import { FUENTE_VALUES, ORDEN_JURISDICCIONES, ORDEN_PARTIDAS } from "@/lib/gasto/constants";
import type { GastoRow } from "@/lib/gasto/logic";
import {
  computeCompositionTable,
  computeHeatmap,
  computeRatioChartData,
  computeWaterfall,
  format1M,
  formatPeriodo,
} from "@/lib/gasto/logic";

const FUENTE_OPTS = [
  { v: "10", l: "10 - TESORO DE LA PROVINCIA" },
  { v: "11", l: "11 - RECURSOS PROPIOS" },
  { v: "12", l: "12 - FINANCIAMIENTO INTERNO" },
  { v: "13", l: "13 - NACIONAL CON AFECTACIÓN ESPECÍFICA" },
  { v: "14", l: "14 - PROVINCIAL CON AFECTACIÓN ESPECÍFICA" },
];

function MultiFuente({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <select
      multiple
      size={4}
      className="gasto-multi"
      value={value}
      onChange={(e) => {
        const sel = Array.from(e.target.selectedOptions).map((o) => o.value);
        onChange(sel);
      }}
    >
      {FUENTE_OPTS.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

function MultiPeriodo({
  periodos,
  value,
  onChange,
}: {
  periodos: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <select
      multiple
      size={6}
      className="gasto-multi"
      value={value}
      onChange={(e) => {
        const sel = Array.from(e.target.selectedOptions).map((o) => o.value);
        onChange(sel);
      }}
    >
      {periodos.map((p) => (
        <option key={p} value={p}>
          {formatPeriodo(p)}
        </option>
      ))}
    </select>
  );
}

function MultiJuris({
  juris,
  value,
  onChange,
}: {
  juris: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <select
      multiple
      size={6}
      className="gasto-multi"
      value={value}
      onChange={(e) => {
        const sel = Array.from(e.target.selectedOptions).map((o) => o.value);
        onChange(sel);
      }}
    >
      {juris.map((j) => (
        <option key={j} value={j}>
          {j}
        </option>
      ))}
    </select>
  );
}

export default function GastoDashboard() {
  const [rawData, setRawData] = useState<GastoRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [hmEstado, setHmEstado] = useState("Comprometido");
  const [hmJurisGroup, setHmJurisGroup] = useState("MINISTERIOS");
  const [hmFuente, setHmFuente] = useState<string[]>(["10"]);

  const allPeriodos = useMemo(
    () => [...new Set(rawData.map((d) => d.periodo))].sort(),
    [rawData],
  );
  const lastPeriodo = allPeriodos.length ? allPeriodos[allPeriodos.length - 1] : "";

  const [tblPeriodo, setTblPeriodo] = useState<string[]>([]);
  const [tblFuente, setTblFuente] = useState<string[]>(["10"]);
  const [tblJuris, setTblJuris] = useState<string[]>([]);

  const [avPeriodo, setAvPeriodo] = useState<string[]>([]);
  const [avFuente, setAvFuente] = useState<string[]>(["10"]);
  const [avJuris, setAvJuris] = useState<string[]>([]);

  const [wfEstado, setWfEstado] = useState("Comprometido");
  const [wfJuris, setWfJuris] = useState("TODAS");
  const [wfPartida, setWfPartida] = useState("TODAS");
  const [wfFuente, setWfFuente] = useState("TODAS");

  useEffect(() => {
    let c = false;
    fetch("/data/gasto_data.json")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los datos de gasto.");
        return r.json() as Promise<GastoRow[]>;
      })
      .then((rows) => {
        if (c) return;
        setRawData(rows);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Error"));
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (lastPeriodo && tblPeriodo.length === 0) setTblPeriodo([lastPeriodo]);
  }, [lastPeriodo, tblPeriodo.length]);

  const jurisEnBD = useMemo(() => {
    const s = new Set(rawData.map((d) => (d.jurisdiccion || "").trim()));
    return ORDEN_JURISDICCIONES.filter((j) => s.has(j));
  }, [rawData]);

  const heatmap = useMemo(() => {
    if (!rawData.length) return null;
    const fuenteFilter =
      hmFuente.length === 0 || hmFuente.length === FUENTE_VALUES.length ? null : hmFuente;
    return computeHeatmap({
      rawData,
      estado: hmEstado,
      jurisGroup: hmJurisGroup,
      fuenteFilter,
    });
  }, [rawData, hmEstado, hmJurisGroup, hmFuente]);

  const table = useMemo(() => {
    if (!rawData.length) return null;
    const periodoSel =
      tblPeriodo.length === 0 || tblPeriodo.length === allPeriodos.length ? null : tblPeriodo;
    const fuenteSel =
      tblFuente.length === 0 || tblFuente.length === FUENTE_VALUES.length ? null : tblFuente;
    const jurisSel =
      tblJuris.length === 0 || tblJuris.length === jurisEnBD.length ? null : tblJuris;
    return computeCompositionTable({ rawData, periodoSel, fuenteSel, jurisSel });
  }, [rawData, tblPeriodo, tblFuente, tblJuris, allPeriodos.length, jurisEnBD.length]);

  const ratio = useMemo(() => {
    if (!rawData.length) return null;
    const periodoSel =
      avPeriodo.length === 0 || avPeriodo.length === allPeriodos.length ? null : avPeriodo;
    const fuenteSel =
      avFuente.length === 0 || avFuente.length === FUENTE_VALUES.length ? null : avFuente;
    const jurisSel =
      avJuris.length === 0 || avJuris.length === jurisEnBD.length ? null : avJuris;
    return computeRatioChartData({
      rawData,
      periodoSel,
      fuenteSel,
      jurisSel,
    });
  }, [rawData, avPeriodo, avFuente, avJuris, allPeriodos.length, jurisEnBD.length]);

  const waterfall = useMemo(() => {
    if (!rawData.length) return null;
    return computeWaterfall({
      rawData,
      estado: wfEstado,
      jurisFilter: wfJuris,
      partidaFilter: wfPartida,
      fuente: wfFuente,
    });
  }, [rawData, wfEstado, wfJuris, wfPartida, wfFuente]);

  if (err) {
    return (
      <div className="chart-container">
        <p style={{ color: "var(--accent-danger)" }}>{err}</p>
      </div>
    );
  }

  if (!rawData.length) {
    return (
      <div className="chart-container">
        <p style={{ color: "var(--text-secondary)" }}>Cargando datos…</p>
      </div>
    );
  }

  return (
    <>
      <section className="chart-container heatmap-section">
        <div
          className="info-tooltip"
          data-tooltip="Mapa de calor del ratio acumulado / Crédito Vigente."
        >
          ?
        </div>
        <div className="section-header">
          <div>
            <h2 className="section-title">{heatmap?.heatmapTitle ?? "Mapa de Calor"}</h2>
            <p className="section-subtitle">Ratio acumulado / Crédito Vigente por partida y organismo</p>
          </div>
        </div>
        <div className="section-filters gasto-filters">
          <div className="sf-group">
            <label>Estado</label>
            <select value={hmEstado} onChange={(e) => setHmEstado(e.target.value)}>
              <option value="Comprometido">Comprometido</option>
              <option value="Ordenado">Ordenado</option>
            </select>
          </div>
          <div className="sf-group">
            <label>Jurisdicción</label>
            <select value={hmJurisGroup} onChange={(e) => setHmJurisGroup(e.target.value)}>
              <option value="TODAS">TODAS LAS JURISDICCIONES</option>
              <option value="MINISTERIOS">MINISTERIOS</option>
              <option value="RESTO">RESTO</option>
            </select>
          </div>
          <div className="sf-group">
            <label>Fuente</label>
            <MultiFuente value={hmFuente} onChange={setHmFuente} />
          </div>
        </div>
        <div id="heatmap-grid" className="heatmap-scroll-wrapper">
          {heatmap && (
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th className="heatmap-corner" />
                  {heatmap.visibleJuris.map((j) => (
                    <th key={j} className="heatmap-juris-header" title={j}>
                      <span>{heatmap.shortName(j)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((row) => (
                  <tr key={row.partida}>
                    <td className="heatmap-partida-label">
                      {row.partida} - {row.code}
                    </td>
                    {row.cells.map((c) => (
                      <td
                        key={c.j}
                        className="heatmap-cell"
                        style={{ backgroundColor: c.color }}
                        title={c.title}
                      >
                        {c.pct}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "1rem" }}>
          Fuente: Ministerio de Hacienda y Finanzas de Corrientes.
        </p>
      </section>

      <section className="chart-container" style={{ marginBottom: "3rem" }}>
        <div className="info-tooltip" data-tooltip="Composición del gasto por partida.">?</div>
        <div className="section-header">
          <div>
            <h2 className="section-title">{table?.title ?? "Composición del Gasto"}</h2>
            <p className="section-subtitle">Crédito vigente, comprometido y ordenado por partida</p>
          </div>
        </div>
        <div className="section-filters gasto-filters">
          <div className="sf-group">
            <label>Período</label>
            <MultiPeriodo periodos={allPeriodos} value={tblPeriodo} onChange={setTblPeriodo} />
          </div>
          <div className="sf-group">
            <label>Fuente</label>
            <MultiFuente value={tblFuente} onChange={setTblFuente} />
          </div>
          <div className="sf-group">
            <label>Jurisdicción</label>
            <MultiJuris juris={jurisEnBD} value={tblJuris} onChange={setTblJuris} />
          </div>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Partida de Gasto</th>
                <th className="numeric">Crédito Vigente</th>
                <th className="numeric">Comprometido</th>
                <th className="numeric">Ordenado</th>
                <th className="numeric">Comp/Vigente (%)</th>
                <th className="numeric">Ord/Vigente (%)</th>
              </tr>
            </thead>
            <tbody>
              {table?.rows.map((r) => (
                <tr key={r.partida}>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: r.colorDot,
                        marginRight: 8,
                      }}
                    />
                    {r.codigo} - {r.partida}
                  </td>
                  <td className="numeric">{format1M(r.vigente)}</td>
                  <td className="numeric">{format1M(r.comprometido)}</td>
                  <td className="numeric">{format1M(r.ordenado)}</td>
                  <td className="numeric">{r.pesoComp.toFixed(2)}%</td>
                  <td className="numeric">{r.pesoOrd.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td>
                <td className="numeric">{table ? format1M(table.tV) : ""}</td>
                <td className="numeric">{table ? format1M(table.tC) : ""}</td>
                <td className="numeric">{table ? format1M(table.tO) : ""}</td>
                <td className="numeric">{table?.totalPesoComp}</td>
                <td className="numeric">{table?.totalPesoOrd}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
          Fuente: Ministerio de Hacienda y Finanzas de Corrientes.
        </p>
      </section>

      <section className="chart-container full-width-chart">
        <div className="info-tooltip" data-tooltip="Avance de ejecución por partida.">?</div>
        <div className="section-header">
          <div>
            <h2 className="section-title">Avance de Ejecución por Partida (Acumulado)</h2>
            <p className="section-subtitle">{ratio?.subtitle}</p>
          </div>
        </div>
        <div className="section-filters gasto-filters">
          <div className="sf-group">
            <label>Período</label>
            <MultiPeriodo periodos={allPeriodos} value={avPeriodo} onChange={setAvPeriodo} />
          </div>
          <div className="sf-group">
            <label>Fuente</label>
            <MultiFuente value={avFuente} onChange={setAvFuente} />
          </div>
          <div className="sf-group">
            <label>Jurisdicción</label>
            <MultiJuris juris={jurisEnBD} value={avJuris} onChange={setAvJuris} />
          </div>
        </div>
        <div className="chart-wrapper" style={{ height: 400 }}>
          {ratio && (
            <Chart type="bar" data={ratio.chartData as ChartData<"bar">} options={ratio.options} />
          )}
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "1rem" }}>
          Fuente: Ministerio de Hacienda y Finanzas de Corrientes.
        </p>
      </section>

      <section className="chart-container full-width-chart">
        <div className="info-tooltip" data-tooltip="Gráfico cascada de ejecución mensual.">?</div>
        <div className="section-header">
          <div>
            <h2 className="section-title">Ejecución Acumulada Gráfico Cascada</h2>
            <p className="section-subtitle">Barras flotantes de ejecución mensual vs techos teóricos</p>
          </div>
        </div>
        <div className="section-filters gasto-filters">
          <div className="sf-group">
            <label>Estado</label>
            <select value={wfEstado} onChange={(e) => setWfEstado(e.target.value)}>
              <option value="Comprometido">Comprometido</option>
              <option value="Ordenado">Ordenado</option>
            </select>
          </div>
          <div className="sf-group">
            <label>Jurisdicción</label>
            <select value={wfJuris} onChange={(e) => setWfJuris(e.target.value)}>
              <option value="TODAS">Todas</option>
              {jurisEnBD.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
          <div className="sf-group">
            <label>Partida</label>
            <select value={wfPartida} onChange={(e) => setWfPartida(e.target.value)}>
              <option value="TODAS">Todas</option>
              {ORDEN_PARTIDAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="sf-group">
            <label>Fuente</label>
            <select value={wfFuente} onChange={(e) => setWfFuente(e.target.value)}>
              <option value="TODAS">Todas</option>
              {FUENTE_OPTS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="chart-wrapper" style={{ height: 400 }}>
          {waterfall && waterfall.chartData.datasets?.length ? (
            <Chart
              type="bar"
              data={waterfall.chartData as ChartData<"bar">}
              options={waterfall.options}
            />
          ) : null}
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "1rem" }}>
          Fuente: Ministerio de Hacienda y Finanzas de Corrientes.
        </p>
      </section>
    </>
  );
}
