import { useState, useEffect, useCallback, useRef } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PageContainer } from '../components/layout'
import { Button, Badge, Modal } from '../components/ui'
import { ChefHat, Clock, CheckCircle2, AlertCircle, RefreshCw, Wifi, WifiOff, Truck, X } from 'lucide-react'
import { kitchenAPI, type Round } from '../services/api'
import { dashboardWS, type WSEvent } from '../services/websocket'
import { useAuthStore, selectIsAuthenticated, selectUserBranchIds, selectUserRoles } from '../stores/authStore'
import { logger } from '../utils/logger'

type RoundStatus = Round['status']

// Flow: PENDING → CONFIRMED → SUBMITTED → IN_KITCHEN → READY → SERVED
// Kitchen sees SUBMITTED, IN_KITCHEN, and READY
const statusConfig: Record<RoundStatus, { label: string; variant: 'default' | 'warning' | 'info' | 'success' | 'danger'; next?: RoundStatus; color: string; actionLabel?: string; actionIcon?: 'chef' | 'check' | 'truck' }> = {
  DRAFT: { label: 'Borrador', variant: 'default', color: 'bg-gray-200' },
  PENDING: { label: 'Pendiente', variant: 'danger', color: 'bg-red-100 border-red-300' },
  CONFIRMED: { label: 'Confirmado', variant: 'info', color: 'bg-blue-100 border-blue-300' },
  SUBMITTED: { label: 'Nuevo', variant: 'warning', next: 'IN_KITCHEN', color: 'bg-yellow-100 border-yellow-300', actionLabel: 'Empezar', actionIcon: 'chef' },
  IN_KITCHEN: { label: 'En Preparación', variant: 'info', next: 'READY', color: 'bg-blue-100 border-blue-300', actionLabel: 'Listo', actionIcon: 'check' },
  READY: { label: 'Listo', variant: 'success', next: 'SERVED', color: 'bg-green-100 border-green-300', actionLabel: 'Entregado', actionIcon: 'truck' },
  SERVED: { label: 'Servido', variant: 'default', color: 'bg-gray-100' },
  CANCELED: { label: 'Cancelado', variant: 'danger', color: 'bg-gray-100' },
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--'
  const date = new Date(dateStr)
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function getElapsedMinutes(dateStr: string | null): number {
  if (!dateStr) return 0
  const date = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / 60000)
}

// Color coding based on elapsed time
function getUrgencyColor(elapsed: number, status: RoundStatus): string {
  if (status === 'READY' || status === 'SERVED') return ''
  if (elapsed > 20) return 'ring-2 ring-red-500 shadow-red-200 shadow-lg'
  if (elapsed > 10) return 'ring-2 ring-orange-400 shadow-orange-200 shadow-md'
  return ''
}

function getTimeColor(elapsed: number, status: RoundStatus): string {
  if (status === 'READY' || status === 'SERVED') return 'text-green-600'
  if (elapsed > 20) return 'text-red-600 font-bold'
  if (elapsed > 10) return 'text-orange-600 font-semibold'
  return 'text-gray-500'
}

// Ticket card that shows items directly
interface TicketCardProps {
  round: Round
  onAction: (roundId: number, status: RoundStatus) => Promise<void>
  isUpdating: boolean
  onClick: () => void
}

function TicketCard({ round, onAction, isUpdating, onClick }: TicketCardProps) {
  const config = statusConfig[round.status]
  const elapsed = getElapsedMinutes(round.submitted_at)
  const urgencyColor = getUrgencyColor(elapsed, round.status)
  const timeColor = getTimeColor(elapsed, round.status)

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (config.next) {
      await onAction(round.id, config.next)
    }
  }

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg border-2 cursor-pointer transition-all duration-200
        hover:shadow-lg ${config.color} ${urgencyColor}
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Header: Table code + time */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-800">
            {round.table_code || `Mesa #${round.table_id || '?'}`}
          </span>
          <Badge variant={config.variant} className="text-xs">
            Ronda #{round.round_number}
          </Badge>
        </div>
        <div className={`flex items-center gap-1 text-sm ${timeColor}`}>
          <Clock className="w-4 h-4" />
          <span>{elapsed}min</span>
        </div>
      </div>

      {/* Items list */}
      <div className="px-3 pb-2 space-y-1">
        {round.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 text-sm">
            <span className="font-bold text-gray-700 min-w-[24px]">{item.qty}x</span>
            <span className="text-gray-800 flex-1">{item.product_name}</span>
            {item.notes && (
              <span className="text-orange-600 text-xs italic truncate max-w-[120px]" title={item.notes}>
                ⚠ {item.notes}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Action button */}
      {config.next && config.actionLabel && (
        <div className="px-3 pb-3 pt-1">
          <button
            onClick={handleAction}
            disabled={isUpdating}
            className={`
              w-full py-2 px-4 rounded-md text-sm font-semibold transition-colors
              flex items-center justify-center gap-2
              ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
              ${round.status === 'SUBMITTED'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : round.status === 'IN_KITCHEN'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }
            `}
          >
            {isUpdating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {config.actionIcon === 'chef' && <ChefHat className="w-4 h-4" />}
                {config.actionIcon === 'check' && <CheckCircle2 className="w-4 h-4" />}
                {config.actionIcon === 'truck' && <Truck className="w-4 h-4" />}
              </>
            )}
            {config.actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}

// Modal for round details
interface RoundDetailModalProps {
  isOpen: boolean
  onClose: () => void
  round: Round | null
  onStatusChange: (roundId: number, status: RoundStatus) => Promise<void>
  isUpdating: boolean
}

function RoundDetailModal({ isOpen, onClose, round, onStatusChange, isUpdating }: RoundDetailModalProps) {
  if (!round) return null

  const config = statusConfig[round.status]
  const elapsed = getElapsedMinutes(round.submitted_at)
  const timeColor = getTimeColor(elapsed, round.status)

  const handleNextStatus = async () => {
    if (config.next) {
      await onStatusChange(round.id, config.next)
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mesa ${round.table_code || round.id}`}>
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
          <Badge variant={config.variant} className="text-sm px-3 py-1">
            {config.label}
          </Badge>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
            <span className={`text-sm ${timeColor}`}>
              {formatTime(round.submitted_at)} ({elapsed} min)
            </span>
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {round.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between p-3 bg-[var(--bg-tertiary)]/50 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-[var(--primary-500)]">
                    {item.qty}x
                  </span>
                  <span className="text-[var(--text-primary)] font-medium">
                    {item.product_name}
                  </span>
                </div>
                {item.notes && (
                  <p className="mt-1 text-sm text-[var(--warning-text)] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-[var(--border-primary)]">
          {config.next && config.actionLabel ? (
            <Button
              onClick={handleNextStatus}
              disabled={isUpdating}
              isLoading={isUpdating}
              className="w-full"
              size="lg"
              leftIcon={
                config.actionIcon === 'chef' ? (
                  <ChefHat className="w-5 h-5" />
                ) : config.actionIcon === 'truck' ? (
                  <Truck className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )
              }
            >
              Marcar como {config.actionLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}

// Column header component
interface ColumnHeaderProps {
  title: string
  count: number
  variant: 'warning' | 'info' | 'success'
  icon: React.ReactNode
}

function ColumnHeader({ title, count, variant, icon }: ColumnHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <Badge variant={variant}>{count}</Badge>
    </div>
  )
}

export function KitchenPage() {
  useDocumentTitle('Cocina')

  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const userBranchIds = useAuthStore(selectUserBranchIds)
  const userRoles = useAuthStore(selectUserRoles)

  const canAccessKitchen = userRoles.includes('KITCHEN') ||
                           userRoles.includes('ADMIN') ||
                           userRoles.includes('MANAGER')

  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWsConnected, setIsWsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingRoundId, setUpdatingRoundId] = useState<number | null>(null)
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Auto-update elapsed time every 30 seconds
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchRounds = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      setError(null)
      const data = await kitchenAPI.getPendingRounds()
      setRounds(data)
    } catch (err) {
      setError('Error al cargar los pedidos')
      logger.error('KitchenPage', 'Fetch error', err)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const handleWSEvent = useCallback((event: WSEvent) => {
    const { type, entity, branch_id } = event

    if (branch_id !== undefined && userBranchIds.length > 0 && !userBranchIds.includes(branch_id)) {
      return
    }

    switch (type) {
      case 'ROUND_SUBMITTED':
        // New round arrived - refetch to get full data
        fetchRounds()
        break

      case 'ROUND_IN_KITCHEN':
        if (entity?.round_id) {
          setRounds((prev) =>
            prev.map((r) =>
              r.id === entity.round_id
                ? { ...r, status: 'IN_KITCHEN' as const }
                : r
            )
          )
        } else {
          fetchRounds()
        }
        break

      case 'ROUND_READY':
        if (entity?.round_id) {
          setRounds((prev) =>
            prev.map((r) =>
              r.id === entity.round_id
                ? { ...r, status: 'READY' as const }
                : r
            )
          )
        } else {
          fetchRounds()
        }
        break

      case 'ROUND_SERVED':
        if (entity?.round_id) {
          setRounds((prev) => prev.filter((r) => r.id !== entity.round_id))
          if (selectedRound?.id === entity.round_id) {
            setIsModalOpen(false)
            setSelectedRound(null)
          }
        }
        break

      case 'ROUND_CANCELED':
        if (entity?.round_id) {
          setRounds((prev) => prev.filter((r) => r.id !== entity.round_id))
          if (selectedRound?.id === entity.round_id) {
            setIsModalOpen(false)
            setSelectedRound(null)
          }
        }
        break
    }
  }, [fetchRounds, userBranchIds, selectedRound])

  const handleWSEventRef = useRef(handleWSEvent)
  useEffect(() => {
    handleWSEventRef.current = handleWSEvent
  })

  useEffect(() => {
    if (isAuthenticated) {
      fetchRounds()
    }
  }, [isAuthenticated, fetchRounds])

  useEffect(() => {
    if (!isAuthenticated) return

    dashboardWS.connect('kitchen')
    const unsubscribeConnection = dashboardWS.onConnectionChange(setIsWsConnected)
    const unsubscribeEvents = dashboardWS.on('*', (event) => handleWSEventRef.current(event))

    return () => {
      unsubscribeConnection()
      unsubscribeEvents()
    }
  }, [isAuthenticated])

  // Fallback polling when WS is disconnected
  useEffect(() => {
    if (!isAuthenticated || isWsConnected) return
    const interval = setInterval(fetchRounds, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated, isWsConnected, fetchRounds])

  const handleStatusChange = async (roundId: number, status: RoundStatus) => {
    setUpdatingRoundId(roundId)
    try {
      const updated = await kitchenAPI.updateRoundStatus(
        roundId,
        status as 'IN_KITCHEN' | 'READY' | 'SERVED'
      )
      setRounds((prev) =>
        prev
          .map((r) => (r.id === roundId ? updated : r))
          .filter((r) => r.status !== 'SERVED')
      )
    } catch (err) {
      setError('Error al actualizar el estado')
      logger.error('KitchenPage', 'Update error', err)
    } finally {
      setUpdatingRoundId(null)
    }
  }

  const openRoundModal = (round: Round) => {
    setSelectedRound(round)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedRound(null)
  }

  // Group rounds by status into 3 columns
  const submittedRounds = rounds.filter((r) => r.status === 'SUBMITTED')
  const inKitchenRounds = rounds.filter((r) => r.status === 'IN_KITCHEN')
  const readyRounds = rounds.filter((r) => r.status === 'READY')

  if (!canAccessKitchen) {
    return (
      <PageContainer
        title="Cocina"
        description="Display de cocina en tiempo real"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[var(--danger-icon)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Acceso restringido
            </h2>
            <p className="text-[var(--text-tertiary)]">
              No tienes permisos para acceder a la cocina.
            </p>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title="Cocina"
      description="Display de cocina en tiempo real"
      actions={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isWsConnected ? (
              <>
                <Wifi className="w-4 h-4 text-[var(--success-icon)]" />
                <span className="text-sm text-[var(--success-icon)]">En vivo</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-[var(--warning-icon)]" />
                <span className="text-sm text-[var(--warning-icon)]">Reconectando...</span>
              </>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={fetchRounds}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Actualizar
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-6 p-4 bg-[var(--danger-border)]/10 border border-[var(--danger-border)]/50 rounded-lg text-[var(--danger-text)] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[var(--danger-text)] hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading && !error ? (
        <div className="flex items-center justify-center h-64" role="status">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--primary-500)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--text-tertiary)]">Conectando al servidor...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: En Espera (SUBMITTED) - waiting to be started */}
          <div>
            <ColumnHeader
              title="En Espera"
              count={submittedRounds.length}
              variant="warning"
              icon={<Clock className="w-5 h-5 text-yellow-500" />}
            />
            <div className="space-y-3">
              {submittedRounds.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] py-12 bg-[var(--bg-secondary)] rounded-lg border-2 border-dashed border-[var(--border-default)]">
                  Sin pedidos en espera
                </div>
              ) : (
                submittedRounds.map((round) => (
                  <TicketCard
                    key={round.id}
                    round={round}
                    onAction={handleStatusChange}
                    isUpdating={updatingRoundId === round.id}
                    onClick={() => openRoundModal(round)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: En Preparación (IN_KITCHEN) - being cooked */}
          <div>
            <ColumnHeader
              title="En Preparación"
              count={inKitchenRounds.length}
              variant="info"
              icon={<ChefHat className="w-5 h-5 text-blue-500" />}
            />
            <div className="space-y-3">
              {inKitchenRounds.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] py-12 bg-[var(--bg-secondary)] rounded-lg border-2 border-dashed border-[var(--border-default)]">
                  Sin pedidos en preparación
                </div>
              ) : (
                inKitchenRounds.map((round) => (
                  <TicketCard
                    key={round.id}
                    round={round}
                    onAction={handleStatusChange}
                    isUpdating={updatingRoundId === round.id}
                    onClick={() => openRoundModal(round)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 3: Listos (READY) - waiting for waiter pickup */}
          <div>
            <ColumnHeader
              title="Listos"
              count={readyRounds.length}
              variant="success"
              icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
            />
            <div className="space-y-3">
              {readyRounds.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] py-12 bg-[var(--bg-secondary)] rounded-lg border-2 border-dashed border-[var(--border-default)]">
                  Sin pedidos listos
                </div>
              ) : (
                readyRounds.map((round) => (
                  <TicketCard
                    key={round.id}
                    round={round}
                    onAction={handleStatusChange}
                    isUpdating={updatingRoundId === round.id}
                    onClick={() => openRoundModal(round)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Round Detail Modal */}
      <RoundDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        round={selectedRound}
        onStatusChange={handleStatusChange}
        isUpdating={updatingRoundId === selectedRound?.id}
      />

      {/* Screen reader announcement */}
      <div role="status" aria-live="polite" className="sr-only">
        {submittedRounds.length} pedidos en espera, {inKitchenRounds.length} en preparación, {readyRounds.length} listos para servir
      </div>
    </PageContainer>
  )
}

export default KitchenPage
