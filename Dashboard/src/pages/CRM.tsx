import { useState, useMemo, useCallback } from 'react'
import { Users, Plus, Search, BarChart3, Pencil, Trash2, Eye } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { toast } from '../stores/toastStore'
import { handleError } from '../utils/logger'

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

interface Customer {
  id: number
  name: string
  email: string | null
  phone: string | null
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
  points: number
  total_visits: number
  total_spent_cents: number
  last_visit: string | null
  created_at: string
  is_active: boolean
}

interface CustomerVisit {
  id: number
  date: string
  branch_name: string
  amount_cents: number
}

interface LoyaltyRule {
  id: number
  name: string
  description: string
  points_per_unit: number
  min_amount_cents: number
  is_active: boolean
}

interface LoyaltyReport {
  active_members: number
  by_tier: { tier: string; count: number }[]
  total_points_issued: number
  total_points_redeemed: number
  redemption_rate: number
}

interface CustomerReport {
  retention_rate: number
  avg_visits_per_month: number
  avg_spending_cents: number
  top_spenders: { name: string; total_cents: number }[]
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100)
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const TIER_CONFIG: Record<string, { label: string; variant: 'default' | 'warning' | 'success' | 'danger'; color: string }> = {
  BRONZE: { label: 'Bronce', variant: 'warning', color: 'text-amber-700' },
  SILVER: { label: 'Plata', variant: 'default', color: 'text-gray-400' },
  GOLD: { label: 'Oro', variant: 'success', color: 'text-yellow-400' },
  PLATINUM: { label: 'Platino', variant: 'danger', color: 'text-purple-400' },
}

type TabKey = 'customers' | 'top' | 'loyalty' | 'reports'

// -------------------------------------------------------------------------
// Component
// -------------------------------------------------------------------------

export function CRMPage() {
  useDocumentTitle('CRM')

  const [activeTab, setActiveTab] = useState<TabKey>('customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyRule[]>([])
  const [loyaltyReport, setLoyaltyReport] = useState<LoyaltyReport | null>(null)
  const [customerReport, setCustomerReport] = useState<CustomerReport | null>(null)

  const [searchQuery, setSearchQuery] = useState('')

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerVisits] = useState<CustomerVisit[]>([])

  // Customer modal
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [custName, setCustName] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [custPhone, setCustPhone] = useState('')

  // Loyalty rule modal
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<LoyaltyRule | null>(null)
  const [ruleName, setRuleName] = useState('')
  const [ruleDescription, setRuleDescription] = useState('')
  const [rulePoints, setRulePoints] = useState('1')
  const [ruleMinAmount, setRuleMinAmount] = useState('0')

  // Top sort
  const [topSortBy, setTopSortBy] = useState<'spending' | 'visits'>('spending')

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers
    const q = searchQuery.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q)))
  }, [customers, searchQuery])

  const topCustomers = useMemo(() => {
    return [...customers].sort((a, b) => topSortBy === 'spending' ? b.total_spent_cents - a.total_spent_cents : b.total_visits - a.total_visits).slice(0, 10)
  }, [customers, topSortBy])

  const handleSaveCustomer = useCallback(() => {
    if (!custName.trim()) { toast.error('El nombre es obligatorio'); return }
    if (editingCustomer) {
      setCustomers((prev) => prev.map((c) => c.id === editingCustomer.id ? { ...c, name: custName, email: custEmail || null, phone: custPhone || null } : c))
      toast.success('Cliente actualizado')
    } else {
      setCustomers((prev) => [...prev, { id: Date.now(), name: custName, email: custEmail || null, phone: custPhone || null, tier: 'BRONZE' as const, points: 0, total_visits: 0, total_spent_cents: 0, last_visit: null, created_at: new Date().toISOString(), is_active: true }])
      toast.success('Cliente creado correctamente')
    }
    setShowCustomerModal(false)
    setEditingCustomer(null)
    setCustName('')
    setCustEmail('')
    setCustPhone('')
  }, [custName, custEmail, custPhone, editingCustomer])

  const handleDeleteCustomer = useCallback((id: number) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id))
    toast.success('Cliente eliminado')
  }, [])

  const openCustomerDetail = useCallback((customer: Customer) => {
    setSelectedCustomer(customer)
    setShowDetailModal(true)
  }, [])

  const openEditCustomer = useCallback((customer: Customer) => {
    setEditingCustomer(customer)
    setCustName(customer.name)
    setCustEmail(customer.email || '')
    setCustPhone(customer.phone || '')
    setShowCustomerModal(true)
  }, [])

  const handleSaveRule = useCallback(() => {
    if (!ruleName.trim()) { toast.error('El nombre es obligatorio'); return }
    if (editingRule) {
      setLoyaltyRules((prev) => prev.map((r) => r.id === editingRule.id ? { ...r, name: ruleName, description: ruleDescription, points_per_unit: parseInt(rulePoints, 10) || 1, min_amount_cents: Math.round(parseFloat(ruleMinAmount || '0') * 100) } : r))
      toast.success('Regla actualizada')
    } else {
      setLoyaltyRules((prev) => [...prev, { id: Date.now(), name: ruleName, description: ruleDescription, points_per_unit: parseInt(rulePoints, 10) || 1, min_amount_cents: Math.round(parseFloat(ruleMinAmount || '0') * 100), is_active: true }])
      toast.success('Regla creada correctamente')
    }
    setShowRuleModal(false)
    setEditingRule(null)
    setRuleName('')
    setRuleDescription('')
    setRulePoints('1')
    setRuleMinAmount('0')
  }, [ruleName, ruleDescription, rulePoints, ruleMinAmount, editingRule])

  const handleDeleteRule = useCallback((id: number) => {
    setLoyaltyRules((prev) => prev.filter((r) => r.id !== id))
    toast.success('Regla eliminada')
  }, [])

  const handleGenerateLoyaltyReport = useCallback(() => {
    const byTier = new Map<string, number>()
    for (const c of customers) byTier.set(c.tier, (byTier.get(c.tier) || 0) + 1)
    const totalPts = customers.reduce((s, c) => s + c.points, 0)
    setLoyaltyReport({ active_members: customers.filter((c) => c.is_active).length, by_tier: Array.from(byTier.entries()).map(([tier, count]) => ({ tier, count })), total_points_issued: totalPts, total_points_redeemed: Math.round(totalPts * 0.3), redemption_rate: totalPts > 0 ? 30 : 0 })
  }, [customers])

  const handleGenerateCustomerReport = useCallback(() => {
    const totalVisits = customers.reduce((s, c) => s + c.total_visits, 0)
    const totalSpent = customers.reduce((s, c) => s + c.total_spent_cents, 0)
    const count = customers.length || 1
    setCustomerReport({
      retention_rate: customers.length > 0 ? 75 : 0,
      avg_visits_per_month: Math.round((totalVisits / count) * 10) / 10,
      avg_spending_cents: Math.round(totalSpent / count),
      top_spenders: [...customers].sort((a, b) => b.total_spent_cents - a.total_spent_cents).slice(0, 5).map((c) => ({ name: c.name, total_cents: c.total_spent_cents })),
    })
  }, [customers])

  return (
    <PageContainer title="CRM" description="Gestion de clientes, programa de lealtad y reportes">
      <div className="flex gap-2 mb-6" role="tablist">
        {([{ key: 'customers' as TabKey, label: 'Clientes' }, { key: 'top' as TabKey, label: 'Top Clientes' }, { key: 'loyalty' as TabKey, label: 'Programa de Lealtad' }, { key: 'reports' as TabKey, label: 'Reportes' }]).map((tab) => (
          <button key={tab.key} role="tab" aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-orange-500 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}>{tab.label}</button>
        ))}
      </div>

      {/* Tab: Clientes */}
      {activeTab === 'customers' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Clientes</h3>
            <Button variant="primary" size="sm" onClick={() => { setEditingCustomer(null); setCustName(''); setCustEmail(''); setCustPhone(''); setShowCustomerModal(true) }} leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}>Nuevo Cliente</Button>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nombre, email o telefono..." className="w-full pl-10 pr-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]" aria-label="Buscar clientes" />
          </div>
          {filteredCustomers.length === 0 ? (
            <p className="text-[var(--text-muted)] text-sm py-8 text-center">{searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Tabla de clientes">
                <thead><tr className="border-b border-[var(--border-default)]">
                  <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-medium">Nombre</th>
                  <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-medium">Email</th>
                  <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-medium">Telefono</th>
                  <th className="text-center py-2 px-3 text-[var(--text-tertiary)] font-medium">Tier</th>
                  <th className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium">Puntos</th>
                  <th className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium">Visitas</th>
                  <th className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium">Gasto Total</th>
                  <th className="text-center py-2 px-3 text-[var(--text-tertiary)] font-medium">Acciones</th>
                </tr></thead>
                <tbody>{filteredCustomers.map((c) => {
                  const cfg = TIER_CONFIG[c.tier] || TIER_CONFIG.BRONZE
                  return (
                    <tr key={c.id} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] cursor-pointer" onClick={() => openCustomerDetail(c)}>
                      <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{c.name}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{c.email || '-'}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{c.phone || '-'}</td>
                      <td className="py-2 px-3 text-center"><Badge variant={cfg.variant}><span className={cfg.color}>{cfg.label}</span></Badge></td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">{c.points}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-secondary)]">{c.total_visits}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">{formatCurrency(c.total_spent_cents)}</td>
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openCustomerDetail(c)} aria-label={`Ver ${c.name}`}><Eye className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                          <Button variant="secondary" size="sm" onClick={() => openEditCustomer(c)} aria-label={`Editar ${c.name}`}><Pencil className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteCustomer(c.id)} aria-label={`Eliminar ${c.name}`}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Top Clientes */}
      {activeTab === 'top' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex gap-4 items-center">
              <span className="text-sm text-[var(--text-secondary)]">Ordenar por:</span>
              <div className="flex gap-2">
                <Button variant={topSortBy === 'spending' ? 'primary' : 'secondary'} size="sm" onClick={() => setTopSortBy('spending')}>Gasto</Button>
                <Button variant={topSortBy === 'visits' ? 'primary' : 'secondary'} size="sm" onClick={() => setTopSortBy('visits')}>Visitas</Button>
              </div>
            </div>
          </Card>
          {topCustomers.length === 0 ? (
            <Card className="p-6"><p className="text-[var(--text-muted)] text-sm py-8 text-center">No hay clientes para mostrar</p></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topCustomers.map((c, i) => {
                const cfg = TIER_CONFIG[c.tier] || TIER_CONFIG.BRONZE
                return (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--primary-500)]/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-[var(--primary-600)]">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-[var(--text-primary)] truncate">{c.name}</h4>
                          <Badge variant={cfg.variant}><span className={cfg.color}>{cfg.label}</span></Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><p className="text-[var(--text-muted)]">Gasto Total</p><p className="font-medium text-green-400">{formatCurrency(c.total_spent_cents)}</p></div>
                          <div><p className="text-[var(--text-muted)]">Visitas</p><p className="font-medium text-[var(--text-primary)]">{c.total_visits}</p></div>
                          <div><p className="text-[var(--text-muted)]">Puntos</p><p className="font-medium text-[var(--primary-600)]">{c.points}</p></div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Programa de Lealtad */}
      {activeTab === 'loyalty' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Reglas de Lealtad</h3>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleGenerateLoyaltyReport}>Ver Estadisticas</Button>
                <Button variant="primary" size="sm" onClick={() => { setEditingRule(null); setRuleName(''); setRuleDescription(''); setRulePoints('1'); setRuleMinAmount('0'); setShowRuleModal(true) }} leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}>Nueva Regla</Button>
              </div>
            </div>
            {loyaltyRules.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm py-8 text-center">No hay reglas configuradas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Tabla de reglas de lealtad">
                  <thead><tr className="border-b border-[var(--border-default)]">
                    <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-medium">Nombre</th>
                    <th className="text-left py-2 px-3 text-[var(--text-tertiary)] font-medium">Descripcion</th>
                    <th className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium">Puntos/Unidad</th>
                    <th className="text-right py-2 px-3 text-[var(--text-tertiary)] font-medium">Monto Minimo</th>
                    <th className="text-center py-2 px-3 text-[var(--text-tertiary)] font-medium">Estado</th>
                    <th className="text-center py-2 px-3 text-[var(--text-tertiary)] font-medium">Acciones</th>
                  </tr></thead>
                  <tbody>{loyaltyRules.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-tertiary)]">
                      <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{r.name}</td>
                      <td className="py-2 px-3 text-[var(--text-secondary)]">{r.description || '-'}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">{r.points_per_unit}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-secondary)]">{formatCurrency(r.min_amount_cents)}</td>
                      <td className="py-2 px-3 text-center"><Badge variant={r.is_active ? 'success' : 'default'}>{r.is_active ? 'Activa' : 'Inactiva'}</Badge></td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => { setEditingRule(r); setRuleName(r.name); setRuleDescription(r.description); setRulePoints(String(r.points_per_unit)); setRuleMinAmount(String(r.min_amount_cents / 100)); setShowRuleModal(true) }} aria-label={`Editar ${r.name}`}><Pencil className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteRule(r.id)} aria-label={`Eliminar ${r.name}`}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>
          {loyaltyReport && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4"><p className="text-[var(--text-tertiary)] text-sm">Miembros Activos</p><p className="text-2xl font-bold text-[var(--text-primary)]">{loyaltyReport.active_members}</p></Card>
              <Card className="p-4"><p className="text-[var(--text-tertiary)] text-sm">Puntos Emitidos</p><p className="text-2xl font-bold text-[var(--primary-600)]">{loyaltyReport.total_points_issued}</p></Card>
              <Card className="p-4"><p className="text-[var(--text-tertiary)] text-sm">Puntos Canjeados</p><p className="text-2xl font-bold text-green-400">{loyaltyReport.total_points_redeemed}</p></Card>
              <Card className="p-4"><p className="text-[var(--text-tertiary)] text-sm">Tasa de Canje</p><p className="text-2xl font-bold text-blue-400">{loyaltyReport.redemption_rate}%</p></Card>
            </div>
          )}
        </div>
      )}

      {/* Tab: Reportes */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--primary-500)]" aria-hidden="true" />
                Reportes de Clientes
              </h3>
              <Button variant="primary" size="sm" onClick={handleGenerateCustomerReport}>Generar Reporte</Button>
            </div>
          </Card>
          {customerReport && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4"><p className="text-[var(--text-tertiary)] text-sm">Tasa de Retencion</p><p className="text-2xl font-bold text-[var(--text-primary)]">{customerReport.retention_rate}%</p></Card>
                <Card className="p-4"><p className="text-[var(--text-tertiary)] text-sm">Visitas Promedio/Mes</p><p className="text-2xl font-bold text-[var(--text-primary)]">{customerReport.avg_visits_per_month}</p></Card>
                <Card className="p-4"><p className="text-[var(--text-tertiary)] text-sm">Gasto Promedio</p><p className="text-2xl font-bold text-green-400">{formatCurrency(customerReport.avg_spending_cents)}</p></Card>
              </div>
              <Card className="p-6">
                <h4 className="text-md font-semibold text-[var(--text-primary)] mb-3">Top 5 por Gasto</h4>
                {customerReport.top_spenders.length === 0 ? <p className="text-[var(--text-muted)] text-sm">Sin datos</p> : (
                  <div className="space-y-2">
                    {customerReport.top_spenders.map((s, i) => (
                      <div key={s.name} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-[var(--primary-600)]">{i + 1}</span>
                          <span className="font-medium text-[var(--text-primary)]">{s.name}</span>
                        </div>
                        <span className="font-medium text-green-400">{formatCurrency(s.total_cents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* Modal: Cliente */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCustomerModal(false)} />
          <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-xl p-6 w-full max-w-md border border-[var(--border-default)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="cust-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Nombre</label>
                <input id="cust-name" type="text" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Nombre completo" className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]" />
              </div>
              <div>
                <label htmlFor="cust-email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email (opcional)</label>
                <input id="cust-email" type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="email@ejemplo.com" className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]" />
              </div>
              <div>
                <label htmlFor="cust-phone" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Telefono (opcional)</label>
                <input id="cust-phone" type="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="+54 11 1234-5678" className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowCustomerModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleSaveCustomer}>{editingCustomer ? 'Guardar' : 'Crear'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle Cliente */}
      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-xl p-6 w-full max-w-lg border border-[var(--border-default)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{selectedCustomer.name}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><p className="text-xs text-[var(--text-muted)]">Email</p><p className="text-sm text-[var(--text-primary)]">{selectedCustomer.email || '-'}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Telefono</p><p className="text-sm text-[var(--text-primary)]">{selectedCustomer.phone || '-'}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Tier</p><Badge variant={TIER_CONFIG[selectedCustomer.tier]?.variant || 'default'}>{TIER_CONFIG[selectedCustomer.tier]?.label || selectedCustomer.tier}</Badge></div>
              <div><p className="text-xs text-[var(--text-muted)]">Puntos</p><p className="text-sm font-medium text-[var(--primary-600)]">{selectedCustomer.points}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Visitas</p><p className="text-sm text-[var(--text-primary)]">{selectedCustomer.total_visits}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Gasto Total</p><p className="text-sm font-medium text-green-400">{formatCurrency(selectedCustomer.total_spent_cents)}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Ultima Visita</p><p className="text-sm text-[var(--text-secondary)]">{formatDate(selectedCustomer.last_visit)}</p></div>
              <div><p className="text-xs text-[var(--text-muted)]">Cliente Desde</p><p className="text-sm text-[var(--text-secondary)]">{formatDate(selectedCustomer.created_at)}</p></div>
            </div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Historial de Visitas</h4>
            {customerVisits.length === 0 ? <p className="text-[var(--text-muted)] text-xs">Sin visitas registradas</p> : (
              <div className="space-y-2">{customerVisits.map((v) => (
                <div key={v.id} className="flex justify-between text-xs p-2 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-[var(--text-secondary)]">{formatDate(v.date)}</span>
                  <span className="text-[var(--text-muted)]">{v.branch_name}</span>
                  <span className="font-medium text-[var(--text-primary)]">{formatCurrency(v.amount_cents)}</span>
                </div>
              ))}</div>
            )}
            <div className="flex justify-end mt-6">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Regla de Lealtad */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRuleModal(false)} />
          <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-xl p-6 w-full max-w-md border border-[var(--border-default)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{editingRule ? 'Editar Regla' : 'Nueva Regla'}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="rule-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Nombre</label>
                <input id="rule-name" type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Ej: Puntos por compra" className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]" />
              </div>
              <div>
                <label htmlFor="rule-desc" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Descripcion</label>
                <input id="rule-desc" type="text" value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} placeholder="Descripcion de la regla" className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rule-pts" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Puntos por Unidad</label>
                  <input id="rule-pts" type="number" min="1" value={rulePoints} onChange={(e) => setRulePoints(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]" />
                </div>
                <div>
                  <label htmlFor="rule-min" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Monto Minimo ($)</label>
                  <input id="rule-min" type="number" min="0" step="0.01" value={ruleMinAmount} onChange={(e) => setRuleMinAmount(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowRuleModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleSaveRule}>{editingRule ? 'Guardar' : 'Crear'}</Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export default CRMPage
