import RoleShell from "../../components/RoleShell";
import { CoachView } from "../../components/RoleViews";

export default function CoachPage() {
  return <RoleShell title="Coach (GVCN)" subtitle="Coachee · buổi họp 4 tuần" allow={["teacher", "homeroom_teacher"]}><CoachView /></RoleShell>;
}
