import RoleShell from "../../components/RoleShell";
import { ParentView } from "../../components/RoleViews";

export default function ParentPage() {
  return <RoleShell title="Theo dõi con" subtitle="Báo cáo đã lọc" allow={["parent"]}><ParentView /></RoleShell>;
}
