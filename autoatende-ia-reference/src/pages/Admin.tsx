import DashboardLayout from "@/src/components/DashboardLayout"

export default function Admin() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Administração Master</h1>
        <p>Apenas para administradores do sistema.</p>
      </div>
    </DashboardLayout>
  )
}
