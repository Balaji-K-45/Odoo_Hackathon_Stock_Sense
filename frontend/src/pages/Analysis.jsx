import { useEffect, useMemo, useState } from "react";
import { ErrorMessage, LoadingSpinner } from "../components/ui";
import { getInventoryAnalysis } from "../services/analysisApi";
import "./Analysis.css";

const DEFAULT_FILTERS = {
  date_from: "",
  date_to: "",
  warehouse_id: "",
  location_id: "",
  category_id: "",
  product_id: "",
  operation_type: "ALL",
};

const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));

const formatDate = (dateValue) => {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const getTrendMax = (items, key) => Math.max(1, ...items.map((item) => Number(item[key] || 0)));

function DonutChart({ healthy, low, outOfStock, overstock, onSelect }) {
  const total = Math.max(1, healthy + low + outOfStock + overstock);
  const segments = [
    { label: "Healthy", value: healthy, color: "#10b981" },
    { label: "Low stock", value: low, color: "#f59e0b" },
    { label: "Out of stock", value: outOfStock, color: "#f43f5e" },
    { label: "Overstock", value: overstock, color: "#0ea5e9" },
  ];

  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="donut-chart" role="img" aria-label="Inventory health chart">
      <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="12" />
      {segments.map((segment) => {
        const circumference = 2 * Math.PI * 38;
        const dash = (segment.value / total) * circumference;
        const circle = (
          <circle
            key={segment.label}
            cx="60"
            cy="60"
            r="38"
            fill="none"
            stroke={segment.color}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            className="donut-segment"
            tabIndex="0"
            onClick={() => onSelect?.(segment)}
            onKeyDown={(event) => event.key === "Enter" && onSelect?.(segment)}
          />
        );
        offset += dash;
        return circle;
      })}
      <text x="60" y="54" textAnchor="middle" className="donut-center-value">{Math.round((healthy / total) * 100)}%</text>
      <text x="60" y="72" textAnchor="middle" className="donut-center-label">Healthy</text>
    </svg>
  );
}

function AnalysisDetailModal({ detail, onClose }) {
  if (!detail) return null;
  return (
    <div className="analysis-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="analysis-detail-modal" role="dialog" aria-modal="true" aria-labelledby="analysis-detail-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="analysis-modal-close" onClick={onClose} aria-label="Close details">x</button>
        <span className="card-kicker">Selected insight</span>
        <h2 id="analysis-detail-title">{detail.title}</h2>
        <p className="analysis-detail-description">{detail.description}</p>
        <div className="analysis-detail-grid">
          {detail.metrics.map((metric) => (
            <div key={metric.label} className="analysis-detail-metric">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      </section>
      <AnalysisDetailModal detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </div>
  );
}

export default function Analysis() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getInventoryAnalysis(filters)
      .then((response) => {
        if (active) setReport(response.data || {});
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load inventory analysis");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [filters]);

  const summary = report?.summary || { total_products: 0, total_stock: 0, low_stock: 0, out_of_stock: 0, overstock: 0, incoming: 0, outgoing: 0, transfers: 0, adjustments: 0 };
  const movement = report?.movement_trend || [];
  const dailyStock = report?.receipts_vs_deliveries || [];
  const warehouseDistribution = report?.warehouse_distribution || [];
  const productMovement = report?.product_movement || [];
  const inventoryHealth = report?.inventory_health || { healthy: 0, low: 0, out_of_stock: 0, overstock: 0 };
  const lowStockItems = report?.low_stock_items || [];
  const transfers = report?.transfers || [];
  const adjustments = report?.adjustments || [];
  const meta = report?.meta || { warehouses: [], locations: [], categories: [], products: [] };

  const maxIncoming = getTrendMax(movement, "incoming");
  const maxOutgoing = getTrendMax(movement, "outgoing");
  const maxMovement = Math.max(maxIncoming, maxOutgoing, 1);
  const maxWarehouseStock = Math.max(1, ...warehouseDistribution.map((item) => Number(item.total_stock || 0)));
  const maxProductMove = Math.max(1, ...productMovement.map((item) => Number(item.total_movement || 0)));
  const maxTransferQty = Math.max(1, ...transfers.map((item) => Number(item.quantity || 0)));

  const warehouseOptions = useMemo(() => meta.warehouses || [], [meta]);
  const locationOptions = useMemo(() => (meta.locations || []).filter((location) => String(location.warehouse_id || "") === String(filters.warehouse_id || "") || !filters.warehouse_id), [meta.locations, filters.warehouse_id]);
  const categoryOptions = useMemo(() => meta.categories || [], [meta]);
  const productOptions = useMemo(() => meta.products || [], [meta]);

  function onFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === "warehouse_id" ? { location_id: "" } : {}),
    }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function showDetail(title, description, metrics) {
    setSelectedDetail({ title, description, metrics });
  }

  if (loading) return <LoadingSpinner message="Loading inventory intelligence..." />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="analysis-page">
      <header className="page-header">
        <div>
          <h1>Inventory Intelligence</h1>
          <p className="page-header-subtitle">Monitor stock health, movement, warehouse activity, and attention areas</p>
        </div>
      </header>

      <section className="analysis-section filter-bar">
        <div className="filter-row">
          <label>
            <span>Date range</span>
            <input type="date" name="date_from" value={filters.date_from} onChange={onFilterChange} />
          </label>
          <label>
            <span>To</span>
            <input type="date" name="date_to" value={filters.date_to} onChange={onFilterChange} />
          </label>
          <label>
            <span>Warehouse</span>
            <select name="warehouse_id" value={filters.warehouse_id} onChange={onFilterChange}>
              <option value="">All warehouses</option>
              {warehouseOptions.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Location</span>
            <select name="location_id" value={filters.location_id} onChange={onFilterChange}>
              <option value="">All locations</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Category</span>
            <select name="category_id" value={filters.category_id} onChange={onFilterChange}>
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Product</span>
            <select name="product_id" value={filters.product_id} onChange={onFilterChange}>
              <option value="">All products</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Operation</span>
            <select name="operation_type" value={filters.operation_type} onChange={onFilterChange}>
              <option value="ALL">All</option>
              <option value="RECEIPT">Receipt</option>
              <option value="DELIVERY">Delivery</option>
              <option value="TRANSFER">Transfer</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </label>
          <button type="button" className="btn btn--secondary flush-button" onClick={resetFilters}>Reset filters</button>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card"><span>Total Products</span><strong>{formatNumber(summary.total_products)}</strong><small>{summary.total_products ? "Active product count" : "No products"}</small></article>
        <article className="kpi-card"><span>Total Stock</span><strong>{formatNumber(summary.total_stock)}</strong><small>Units in stock</small></article>
        <article className="kpi-card"><span>Low Stock</span><strong>{formatNumber(summary.low_stock)}</strong><small>At or below reorder</small></article>
        <article className="kpi-card"><span>Overstock</span><strong>{formatNumber(summary.overstock)}</strong><small>Above threshold</small></article>
        <article className="kpi-card"><span>Incoming</span><strong>{formatNumber(summary.incoming)}</strong><small>Stock received</small></article>
        <article className="kpi-card"><span>Outgoing</span><strong>{formatNumber(summary.outgoing)}</strong><small>Stock delivered</small></article>
        <article className="kpi-card"><span>Transfers</span><strong>{formatNumber(summary.transfers)}</strong><small>Qty moved</small></article>
        <article className="kpi-card"><span>Adjustments</span><strong>{formatNumber(summary.adjustments)}</strong><small>Corrections logged</small></article>
      </section>

      <section className="analysis-grid two-col">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="card-kicker">Movement trend</span>
              <h3>Stock Movement Trend</h3>
            </div>
          </div>
          {movement.length ? (
            <div className="line-chart-wrap">
              <svg viewBox="0 0 520 220" className="trend-svg" preserveAspectRatio="none" role="img" aria-label="Stock movement trend">
                {[0, 1, 2, 3].map((step) => <line key={step} x1="0" y1={20 + step * 52} x2="520" y2={20 + step * 52} className="chart-gridline" />)}
                {[...Array(Math.min(6, movement.length)).keys()].map((idx) => {
                  const x = 20 + (idx * (480 / Math.max(1, movement.length - 1)));
                  return <line key={idx} x1={x} y1="0" x2={x} y2="220" className="chart-gridline vertical" />;
                })}
                {movement.map((item, idx) => {
                  const x = 20 + (idx * (480 / Math.max(1, movement.length - 1)));
                  const incomingY = 190 - (Number(item.incoming || 0) / maxMovement) * 150;
                  const outgoingY = 190 - (Number(item.outgoing || 0) / maxMovement) * 150;
                  const netY = 190 - (Number(item.net || 0) / maxMovement) * 150;
                  return (
                    <g key={item.date}>
                      <circle className="chart-point" cx={x} cy={incomingY} r="5" fill="#10b981" onClick={() => showDetail(`Incoming on ${formatDate(item.date)}`, "Stock received during this period.", [{ label: "Quantity", value: formatNumber(item.incoming) }, { label: "Net change", value: formatNumber(item.net) }])} />
                      <circle className="chart-point" cx={x} cy={outgoingY} r="5" fill="#f43f5e" onClick={() => showDetail(`Outgoing on ${formatDate(item.date)}`, "Stock delivered during this period.", [{ label: "Quantity", value: formatNumber(item.outgoing) }, { label: "Net change", value: formatNumber(item.net) }])} />
                      <circle className="chart-point" cx={x} cy={netY} r="5" fill="#0ea5e9" onClick={() => showDetail(`Net movement on ${formatDate(item.date)}`, "The balance between incoming and outgoing stock.", [{ label: "Net movement", value: formatNumber(item.net) }, { label: "Incoming", value: formatNumber(item.incoming) }, { label: "Outgoing", value: formatNumber(item.outgoing) }])} />
                    </g>
                  );
                })}
                <polyline points={movement.map((item, idx) => `${20 + (idx * (480 / Math.max(1, movement.length - 1)))},${190 - (Number(item.incoming || 0) / maxMovement) * 150}`).join(" ")} fill="none" stroke="#10b981" strokeWidth="3" />
                <polyline points={movement.map((item, idx) => `${20 + (idx * (480 / Math.max(1, movement.length - 1)))},${190 - (Number(item.outgoing || 0) / maxMovement) * 150}`).join(" ")} fill="none" stroke="#f43f5e" strokeWidth="3" />
                <polyline points={movement.map((item, idx) => `${20 + (idx * (480 / Math.max(1, movement.length - 1)))},${190 - (Number(item.net || 0) / maxMovement) * 150}`).join(" ")} fill="none" stroke="#0ea5e9" strokeWidth="3" />
              </svg>
              <div className="legend-inline">
                <span><i className="legend-dot green" />Incoming</span>
                <span><i className="legend-dot red" />Outgoing</span>
                <span><i className="legend-dot blue" />Net</span>
              </div>
            </div>
          ) : <p className="analysis-empty">No movement data found for the selected range.</p>}
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="card-kicker">Warehouse stock</span>
              <h3>Warehouse Stock Distribution</h3>
            </div>
          </div>
          {warehouseDistribution.length ? (
            <div className="stacked-bars">
              {warehouseDistribution.map((item) => (
                <div key={item.warehouse_id} className="bar-row analysis-clickable" role="button" tabIndex="0" onClick={() => showDetail(item.warehouse_name, "Warehouse stock distribution for the selected filters.", [{ label: "Total stock", value: formatNumber(item.total_stock) }, { label: "Warehouse", value: item.warehouse_name }])}>
                  <div className="bar-meta"><span>{item.warehouse_name}</span><strong>{formatNumber(item.total_stock)}</strong></div>
                  <div className="bar-track"><i style={{ width: `${(Number(item.total_stock) / maxWarehouseStock) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="analysis-empty">No warehouse stock data available.</p>}
        </div>
      </section>

      <section className="analysis-grid two-col">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="card-kicker">Inbound vs outbound</span>
              <h3>Receipts vs Deliveries</h3>
            </div>
          </div>
          {dailyStock.length ? (
            <div className="bar-chart-wrap">
              {dailyStock.map((item) => (
                <div key={item.date} className="day-bar-group analysis-clickable" role="button" tabIndex="0" onClick={() => showDetail(`Movement on ${formatDate(item.date)}`, "Inbound and outbound activity for this date.", [{ label: "Receipts", value: formatNumber(item.receipts) }, { label: "Deliveries", value: formatNumber(item.deliveries) }])}>
                  <div className="mini-bars">
                    <span className="mini-receipt" style={{ height: `${(Number(item.receipts || 0) / Math.max(1, Number(item.receipts || 0) + Number(item.deliveries || 0))) * 100}%` }} />
                    <span className="mini-delivery" style={{ height: `${(Number(item.deliveries || 0) / Math.max(1, Number(item.receipts || 0) + Number(item.deliveries || 0))) * 100}%` }} />
                  </div>
                  <small>{formatDate(item.date)}</small>
                </div>
              ))}
            </div>
          ) : <p className="analysis-empty">No inbound/outbound movement recorded.</p>}
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="card-kicker">Transfer flow</span>
              <h3>Warehouse Transfer Activity</h3>
            </div>
          </div>
          {transfers.length ? (
            <div className="transfer-list">
              {transfers.map((item, index) => (
                <div key={`${item.from}-${item.to}-${index}`} className="transfer-row analysis-clickable" role="button" tabIndex="0" onClick={() => showDetail(`${item.from} to ${item.to}`, "Transfer activity between storage locations.", [{ label: "Quantity moved", value: formatNumber(item.quantity) }, { label: "From", value: item.from }, { label: "To", value: item.to }])}>
                  <div className="transfer-labels"><span>{item.from}</span><span>→</span><span>{item.to}</span></div>
                  <div className="transfer-track"><i style={{ width: `${(Number(item.quantity) / maxTransferQty) * 100}%` }} /></div>
                  <strong>{formatNumber(item.quantity)} units</strong>
                </div>
              ))}
            </div>
          ) : <p className="analysis-empty">No transfer records in the selected period.</p>}
        </div>
      </section>

      <section className="analysis-grid two-col">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="card-kicker">Most moved</span>
              <h3>Most Moved Products</h3>
            </div>
          </div>
          {productMovement.length ? (
            <div className="movement-list">
              {productMovement.map((item) => (
                <div key={item.product_id} className="movement-row analysis-clickable" role="button" tabIndex="0" onClick={() => showDetail(item.name, "Product movement across the selected analysis range.", [{ label: "Total movement", value: formatNumber(item.total_movement) }, { label: "Product", value: item.name }])}>
                  <div className="bar-meta"><span>{item.name}</span><strong>{formatNumber(item.total_movement)}</strong></div>
                  <div className="bar-track"><i style={{ width: `${(Number(item.total_movement) / maxProductMove) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="analysis-empty">No product movement data found.</p>}
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="card-kicker">Inventory health</span>
              <h3>Inventory Health</h3>
            </div>
          </div>
          <div className="donut-layout">
            <DonutChart {...inventoryHealth} onSelect={(segment) => showDetail(segment.label, "Inventory health segment for the current stock snapshot.", [{ label: "Products", value: formatNumber(segment.value) }, { label: "Share", value: `${Math.round((segment.value / Math.max(1, inventoryHealth.healthy + inventoryHealth.low + inventoryHealth.out_of_stock + inventoryHealth.overstock)) * 100)}%` }])} />
            <div className="health-summary">
              <div><span className="legend-dot green" />Healthy <strong>{inventoryHealth.healthy}</strong></div>
              <div><span className="legend-dot yellow" />Low Stock <strong>{inventoryHealth.low}</strong></div>
              <div><span className="legend-dot red" />Out of Stock <strong>{inventoryHealth.out_of_stock}</strong></div>
              <div><span className="legend-dot blue" />Overstock <strong>{inventoryHealth.overstock}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="analysis-grid two-col">
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="card-kicker">Adjustments</span>
              <h3>Inventory Adjustments</h3>
            </div>
          </div>
          {adjustments.length ? (
            <div className="adjustment-list">
              {adjustments.map((item, idx) => (
                <div key={`${item.date}-${idx}`} className="adjustment-row analysis-clickable" role="button" tabIndex="0" onClick={() => showDetail(`Adjustment on ${formatDate(item.date)}`, "Inventory corrections recorded during the selected range.", [{ label: "Added", value: formatNumber(item.positive) }, { label: "Removed", value: formatNumber(item.negative) }])}>
                  <span>{formatDate(item.date)}</span>
                  <strong className={Number(item.positive || 0) > 0 ? "text-positive" : "text-negative"}>{Number(item.positive || 0) > 0 ? `+${formatNumber(item.positive)}` : `-${formatNumber(item.negative)}`}</strong>
                </div>
              ))}
            </div>
          ) : <p className="analysis-empty">No adjustment records for this period.</p>}
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="card-kicker">Attention required</span>
              <h3>Products Requiring Attention</h3>
            </div>
          </div>
          {lowStockItems.length ? (
            <div className="table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Current</th>
                    <th>Min</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => (
                    <tr key={item.product_id} className="analysis-clickable" onClick={() => showDetail(item.name, "This product is below its configured inventory threshold.", [{ label: "Current stock", value: formatNumber(item.current_stock) }, { label: "Minimum stock", value: formatNumber(item.minimum_stock) }, { label: "Status", value: item.status }])}>
                      <td>{item.name}</td>
                      <td>{item.sku}</td>
                      <td>{formatNumber(item.current_stock)}</td>
                      <td>{formatNumber(item.minimum_stock)}</td>
                      <td><span className={`status-pill ${item.status.toLowerCase().replace(/\s+/g, "-")}`}>{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="analysis-empty">All inventory is within healthy thresholds.</p>}
        </div>
      </section>
    </div>
  );
}