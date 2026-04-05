import { useMemo, useCallback, useState, useEffect, useActionState } from 'react'
import { Plus, Pencil, Trash2, Truck } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useFormModal } from '../hooks/useFormModal'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { usePagination } from '../hooks/usePagination'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Table } from '../components/ui/Table'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Badge } from '../components/ui/Badge'
import { Pagination } from '../components/ui/Pagination'
import { toast } from '../stores/toastStore'
import { handleError } from '../utils/logger'
import type { TableColumn } from '../types'
import type { FormState } from '../types/form'

interface Supplier {
  id: number
  tenant_id: number
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
}

interface SupplierFormData {
  name: string
  contact_name: string
  phone: string
  email: string
  address: string
  notes: string
}

const initialFormData: SupplierFormData = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

function getAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
    'Content-Type': 'application/json',
  }
}

export function SuppliersPage() {
  useDocumentTitle('Proveedores')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)

  const modal = useFormModal<SupplierFormData, Supplier>(initialFormData)
  const deleteDialog = useConfirmDialog<Supplier>()

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/admin/suppliers`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      })
      if (res.ok) {
        setSuppliers(await res.json())
      }
    } catch (error) {
      handleError(error, 'SuppliersPage.fetchSuppliers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers]
  )

  const {
    paginatedItems,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(sortedSuppliers)

  const submitAction = useCallback(
    async (_prevState: FormState<SupplierFormData>, formData: FormData): Promise<FormState<SupplierFormData>> => {
      const data: SupplierFormData = {
        name: formData.get('name') as string,
        contact_name: formData.get('contact_name') as string,
        phone: formData.get('phone') as string,
        email: formData.get('email') as string,
        address: formData.get('address') as string,
        notes: formData.get('notes') as string,
      }

      if (!data.name.trim()) {
        return { errors: { name: 'El nombre es requerido' }, isSuccess: false }
      }

      try {
        const isEditing = !!modal.selectedItem
        const url = isEditing
          ? `${API_URL}/admin/suppliers/${modal.selectedItem!.id}`
          : `${API_URL}/admin/suppliers`
        const method = isEditing ? 'PATCH' : 'POST'

        const res = await fetch(url, {
          method,
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Error desconocido' }))
          return { isSuccess: false, message: err.detail || 'Error al guardar' }
        }

        toast.success(isEditing ? 'Proveedor actualizado' : 'Proveedor creado')
        fetchSuppliers()
        return { isSuccess: true, message: 'Guardado correctamente' }
      } catch (error) {
        const message = handleError(error, 'SuppliersPage.submitAction')
        toast.error(`Error: ${message}`)
        return { isSuccess: false, message: `Error: ${message}` }
      }
    },
    [modal.selectedItem, fetchSuppliers]
  )

  const [state, formAction, isPending] = useActionState<FormState<SupplierFormData>, FormData>(
    submitAction,
    { isSuccess: false }
  )

  // Close modal on success
  if (state.isSuccess && modal.isOpen) {
    modal.close()
  }

  const handleDelete = useCallback(async () => {
    if (!deleteDialog.item) return
    try {
      const res = await fetch(`${API_URL}/admin/suppliers/${deleteDialog.item.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      })
      if (res.ok || res.status === 204) {
        toast.success('Proveedor eliminado')
        fetchSuppliers()
      } else {
        toast.error('Error al eliminar proveedor')
      }
    } catch (error) {
      const message = handleError(error, 'SuppliersPage.handleDelete')
      toast.error(`Error: ${message}`)
    }
    deleteDialog.close()
  }, [deleteDialog, fetchSuppliers])

  const handleOpenEdit = useCallback(
    (supplier: Supplier) => {
      modal.openEdit(supplier, {
        name: supplier.name,
        contact_name: supplier.contact_name || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        notes: supplier.notes || '',
      })
    },
    [modal]
  )

  const columns: TableColumn<Supplier>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'Nombre',
        render: (item: Supplier) => (
          <span className="font-medium text-[var(--text-primary)]">{item.name}</span>
        ),
      },
      {
        key: 'contact_name',
        label: 'Contacto',
        render: (item: Supplier) => (
          <span className="text-[var(--text-secondary)]">{item.contact_name || '-'}</span>
        ),
      },
      {
        key: 'phone',
        label: 'Teléfono',
        render: (item: Supplier) => (
          <span className="text-[var(--text-secondary)]">{item.phone || '-'}</span>
        ),
      },
      {
        key: 'email',
        label: 'Email',
        render: (item: Supplier) => (
          <span className="text-[var(--text-secondary)]">{item.email || '-'}</span>
        ),
      },
      {
        key: 'is_active',
        label: 'Estado',
        render: (item: Supplier) => (
          <Badge variant={item.is_active ? 'success' : 'danger'}>
            {item.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        label: '',
        render: (item: Supplier) => (
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(item)}
              aria-label={`Editar ${item.name}`}
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteDialog.open(item)}
              aria-label={`Eliminar ${item.name}`}
            >
              <Trash2 className="w-4 h-4 text-red-500" aria-hidden="true" />
            </Button>
          </div>
        ),
      },
    ],
    [handleOpenEdit, deleteDialog]
  )

  return (
    <PageContainer
      title="Proveedores"
      description="Gestión de proveedores de ingredientes"
      actions={
        <Button onClick={() => modal.openCreate(initialFormData)} aria-label="Crear proveedor">
          <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
          Nuevo Proveedor
        </Button>
      }
    >
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="sr-only">Cargando proveedores</span>
          </div>
        ) : sortedSuppliers.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <Truck className="mx-auto h-12 w-12 mb-4 opacity-50" aria-hidden="true" />
            <p>No hay proveedores registrados</p>
          </div>
        ) : (
          <>
            <Table data={paginatedItems} columns={columns} ariaLabel="Tabla de proveedores" />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={modal.close}
        title={modal.selectedItem ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={modal.close}>
              Cancelar
            </Button>
            <Button type="submit" form="supplier-form" isLoading={isPending}>
              {modal.selectedItem ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        }
      >
        <form id="supplier-form" action={formAction} className="space-y-4">
          <Input
            label="Nombre *"
            name="name"
            defaultValue={modal.formData.name}
            error={state.errors?.name}
            required
          />
          <Input
            label="Contacto"
            name="contact_name"
            defaultValue={modal.formData.contact_name}
          />
          <Input
            label="Teléfono"
            name="phone"
            defaultValue={modal.formData.phone}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            defaultValue={modal.formData.email}
          />
          <Input
            label="Dirección"
            name="address"
            defaultValue={modal.formData.address}
          />
          <Textarea
            label="Notas"
            name="notes"
            defaultValue={modal.formData.notes}
          />
          {state.message && !state.isSuccess && (
            <p className="text-red-500 text-sm" role="alert">{state.message}</p>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        onConfirm={handleDelete}
        title="Eliminar Proveedor"
        description={`¿Estás seguro de eliminar "${deleteDialog.item?.name}"? Esta acción no se puede deshacer.`}
        variant="danger"
      />
    </PageContainer>
  )
}

export default SuppliersPage
