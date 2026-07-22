import RoleShell from "../../components/RoleShell";
import { DpoView } from "../../components/RoleViews";

export default function DpoPage() {
  return <RoleShell title="Bảo vệ dữ liệu (DPO)" subtitle="Consent · audit" allow={["dpo"]}><DpoView /></RoleShell>;
}
