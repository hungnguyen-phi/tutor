import RoleShell from "../../components/RoleShell";
import { BuddyView } from "../../components/RoleViews";

export default function BuddyPage() {
  return <RoleShell title="Buddy" subtitle="Đồng hành cùng bạn học" allow={["admin"]} allowBuddy><BuddyView /></RoleShell>;
}
