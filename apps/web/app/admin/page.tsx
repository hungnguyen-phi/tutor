import RoleShell from "../../components/RoleShell";
import { AdminView } from "../../components/RoleViews";

export default function AdminPage() {
  return <RoleShell title="Admin hệ thống" subtitle="RBAC · gateway · vận hành" allow={["admin"]}><AdminView /></RoleShell>;
}
